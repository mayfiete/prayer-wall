# ADR-004 — Giving Wall Architecture

**Date:** August 16, 2026  
**Branch:** `feat/giving-wall-starter`  
**Status:** Draft — pre-implementation  
**Author:** Terry Mayfield
**Supersedes:** none  
**Related:** ADR-001 (clean architecture), ADR-002 (prayer_wall schema), ADR-003 (mock vs Supabase repos), meeting notes 2026-08-05

---

## Context

HCA has approved a Giving Wall to accompany the Prayer Foundation. Both products share a core user experience: a visitor sees a brick wall, clicks an open brick, and their name appears as a new brick in real time. The Giving Wall diverges at the submission step — instead of a prayer commitment form, it presents a payment flow. A **webhook from the payment processor**, not the browser, creates the donation record. The brick only appears after payment is confirmed.

This document records the full technical plan: what is reused, what is new, the complete database schema with SQL, the Stripe webhook implementation in full, the RLS strategy, the edge function contracts, the app structure, and the implementation sequence.

---

## Goals

1. Reuse as much of the Prayer Wall codebase as possible — wall grid, brick rendering, realtime, theme system, admin shell, infrastructure patterns.
2. Keep the two apps independently deployable via separate Railway services with their own `VITE_*` env vars.
3. Add only genuinely new domain concepts: `Donation`, `IGivingWallRepository`, the webhook edge function, and the payment integration.
4. Never allow the browser to write donation records directly. The payment processor is the authoritative source.
5. Maintain a complete, auditable record of every payment event — not just successful donations.

---

## What Is Reused Unchanged

| Layer | Asset | Notes |
|---|---|---|
| **Schema** | `prayer_wall` schema, `organizations`, `walls`, `wall_theme`, `email_logs` | New tables added alongside |
| **Theme engine** | `wall_theme` table, `applyTheme()`, `THEME_DEFAULTS`, CSS vars | Giving wall gets its own `wall_id` row |
| **Wall grid** | `PrayerWallGrid`, `PrayerBrick`, `CtaBrick`, `useStonesPerRow` | Import directly; swap entity type at call site |
| **Realtime pattern** | `useRealtimePrayers` as template for `useRealtimeDonations` | Identical subscription logic, different table |
| **Admin shell** | `AdminPage`, `AdminAuthGuard`, tab nav pattern | Remove Categories/Rhythms tabs; add Donors tab |
| **Admin components** | `ThemeAdmin`, `AssetAdmin` | Copied verbatim |
| **Infrastructure** | `supabaseClient`, `createSupabaseClient()`, `container.ts` pattern, `VITE_USE_MOCK` flag | Identical approach |
| **App bootstrap** | `main.tsx` — theme load, texture + logo fetch from Storage | Identical; different `VITE_ASSETS_BUCKET` |
| **Email infra** | Resend API, `email-layout.ts` `BRAND`/`COLORS` helpers, `email_logs` table | New email type added; new edge function |
| **UI primitives** | `Modal`, `Input`, `Button`, `MockBanner` | Verbatim copy |
| **Unsubscribe flow** | `/unsubscribe` route, `unsubscribe` edge function | Shared or copied; acts on `donations.email_opt_out` |

---

## What Is Different

| Concern | Prayer Wall | Giving Wall |
|---|---|---|
| **Brick creation trigger** | Browser → `SubmitPrayerCommitment` → `commitments` INSERT | Payment processor webhook → `giving-wall-webhook` → `donations` INSERT |
| **Form** | Name + email + prayer category selection | Name only (or none — pulled from processor payload) |
| **Domain entity** | `Prayer` / `PrayerWithCategories` | `Donation` |
| **Repository** | `IPrayerRepository` | `IGivingWallRepository` |
| **Categories** | Multi-select; core to the experience | None |
| **Email cadence** | Weekly reminders via `pg_cron` + `email_rhythms` | Single immediate thank-you on confirmed payment |
| **CTA brick icon** | `PrayerHandsIcon` (custom SVG) | Gift/heart icon (TBD with Ivy) |
| **Admin tabs** | Categories · Rhythms · Assets · Theme · Stonemasons | Donors · Assets · Theme |
| **DB write authority** | Browser (anon INSERT policy on `commitments`) | Edge function only (service_role; no public INSERT on `donations`) |
| **Auditability** | `email_logs` tracks emails sent | `webhook_events` table tracks every raw processor event |

---

## System Architecture

```
Donor's browser
│  1. Loads giving wall (GivingWallGrid shows filled bricks + one CTA brick)
│  2. Clicks CTA brick → PaymentModal opens
│  3. PaymentModal renders Stripe Payment Element (iframe, on-domain)
│  4. Donor submits card details → Stripe processes payment
│
│  [browser plays no further role in brick creation]
│
Stripe
│  5. Fires POST webhook to Supabase edge function URL
│     POST https://<ref>.supabase.co/functions/v1/giving-wall-webhook
│
Supabase Edge Function: giving-wall-webhook
│  6. Verifies Stripe-Signature HMAC header
│  7. Inserts raw event into webhook_events (audit log — always, even on failure)
│  8. Checks event type = payment_intent.succeeded
│  9. Checks idempotency: processor_ref already in donations? → 200, skip
│  10. Inserts row into prayer_wall.donations
│  11. Invokes send-donation-thanks (fire-and-forget, no await)
│  12. Returns 200 OK to Stripe
│
Supabase Realtime
│  13. INSERT on donations table fires Realtime event
│
Donor's browser (still open)
│  14. useRealtimeDonations receives INSERT payload
│  15. addDonation() prepends new Donation to state
│  16. DonationBrick animates in with donor's name
│
Supabase Edge Function: send-donation-thanks
│  17. Fetches donation + org name
│  18. Sends thank-you email via Resend
│  19. Updates donations.thank_you_sent = true
│  20. Logs to email_logs (email_type = 'donation_thank_you')
```

---

## Complete Database Schema

### Migration `022_giving_wall.sql`

This is the full, runnable migration. It follows the same conventions as existing migrations in `supabase/migrations/`.

```sql
-- ============================================================
-- 022_giving_wall.sql
-- Introduces the Giving Wall product:
--   - giving_walls    wall instances for the giving product
--   - donations       one row per confirmed payment
--   - webhook_events  raw audit log of every processor event
-- Also extends email_logs CHECK constraint to include the new
-- donation_thank_you email type.
-- ============================================================

-- ── 1. Giving wall instances ──────────────────────────────────────────────────
-- Parallel to prayer_wall.walls. Separate table so the giving wall
-- can evolve independently (different columns, policies, etc.)

CREATE TABLE prayer_wall.giving_walls (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES prayer_wall.organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE INDEX ix_giving_walls_org ON prayer_wall.giving_walls(org_id);

-- ── 2. Donations ──────────────────────────────────────────────────────────────
-- One row per confirmed payment. Only the webhook edge function (service_role)
-- may INSERT here. The browser has no INSERT policy.

CREATE TABLE prayer_wall.donations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id         UUID        NOT NULL REFERENCES prayer_wall.giving_walls(id) ON DELETE CASCADE,

  -- Display fields (shown publicly on the wall)
  name            TEXT        NOT NULL,          -- donor's display name on brick
  is_anonymous    BOOLEAN     NOT NULL DEFAULT false,

  -- Financial fields (not shown publicly)
  amount_cents    INTEGER     NOT NULL CHECK (amount_cents >= 0),
  currency        TEXT        NOT NULL DEFAULT 'usd',

  -- Contact (not shown publicly; used for thank-you email)
  email           TEXT,                          -- null if processor did not supply one

  -- Processor linkage
  processor       TEXT        NOT NULL DEFAULT 'stripe',   -- 'stripe' | 'justify' | 'gettrx'
  processor_ref   TEXT        NOT NULL UNIQUE,  -- Stripe PaymentIntent ID or equivalent
                                                -- UNIQUE enforces idempotency at DB level

  -- Lifecycle
  donated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  thank_you_sent  BOOLEAN     NOT NULL DEFAULT false,
  email_opt_out   BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX ix_donations_wall        ON prayer_wall.donations(wall_id);
CREATE INDEX ix_donations_donated_at  ON prayer_wall.donations(donated_at DESC);
CREATE INDEX ix_donations_processor_ref ON prayer_wall.donations(processor_ref);

-- ── 3. Webhook event audit log ────────────────────────────────────────────────
-- Every inbound webhook POST is recorded here BEFORE any processing.
-- This provides:
--   - Full auditability of what Stripe sent and when
--   - Replay capability for debugging failed donations
--   - Evidence of duplicate delivery (Stripe sends webhooks at least once)
--   - Forensic record if a processor_ref appears in donations but not here

CREATE TABLE prayer_wall.webhook_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id         UUID        REFERENCES prayer_wall.giving_walls(id) ON DELETE SET NULL,

  -- Processor identification
  processor       TEXT        NOT NULL DEFAULT 'stripe',
  event_type      TEXT        NOT NULL,          -- e.g. 'payment_intent.succeeded'
  processor_event_id TEXT     NOT NULL UNIQUE,   -- Stripe Event ID (evt_...)

  -- Raw payload — stored as JSONB for queryability
  raw_payload     JSONB       NOT NULL,

  -- Processing outcome
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processed', 'skipped', 'failed')),
  donation_id     UUID        REFERENCES prayer_wall.donations(id) ON DELETE SET NULL,
  error_message   TEXT,                          -- populated on status = 'failed'

  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX ix_webhook_events_processor_event_id ON prayer_wall.webhook_events(processor_event_id);
CREATE INDEX ix_webhook_events_wall               ON prayer_wall.webhook_events(wall_id);
CREATE INDEX ix_webhook_events_status             ON prayer_wall.webhook_events(status);
CREATE INDEX ix_webhook_events_received_at        ON prayer_wall.webhook_events(received_at DESC);

-- ── 4. Extend email_logs to include donation thank-you type ──────────────────
-- The existing CHECK constraint on email_type only allows 'reminder',
-- 'confirmation', 'summary'. Add 'donation_thank_you'.

ALTER TABLE prayer_wall.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_email_type_check;

ALTER TABLE prayer_wall.email_logs
  ADD CONSTRAINT email_logs_email_type_check
    CHECK (email_type IN ('reminder', 'confirmation', 'summary', 'donation_thank_you'));

-- ── 5. wall_theme FK note ─────────────────────────────────────────────────────
-- wall_theme.wall_id currently references prayer_wall.walls(id).
-- The giving wall has its own separate table (giving_walls).
-- Two options: (a) add a nullable giving_wall_id FK to wall_theme,
-- or (b) treat wall_theme as a generic key-value store keyed by any UUID.
--
-- Decision: add a nullable giving_wall_id column so theme rows can be
-- associated with either product. The existing wall_id FK remains for
-- prayer wall rows; giving wall rows set wall_id = NULL and giving_wall_id = <id>.
-- Both columns have UNIQUE constraints so one theme row per wall.

ALTER TABLE prayer_wall.wall_theme
  ADD COLUMN IF NOT EXISTS giving_wall_id UUID
    REFERENCES prayer_wall.giving_walls(id) ON DELETE CASCADE,
  ADD CONSTRAINT wall_theme_giving_wall_unique UNIQUE (giving_wall_id);

-- At least one of wall_id or giving_wall_id must be set
ALTER TABLE prayer_wall.wall_theme
  ADD CONSTRAINT wall_theme_has_wall
    CHECK (wall_id IS NOT NULL OR giving_wall_id IS NOT NULL);

-- ── 6. Realtime ───────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_wall.donations;
-- webhook_events intentionally excluded from realtime (internal only)

-- ── 7. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE prayer_wall.giving_walls   ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_wall.donations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_wall.webhook_events ENABLE ROW LEVEL SECURITY;

-- giving_walls: public read of active walls
CREATE POLICY "giving_walls_public_read"
  ON prayer_wall.giving_walls FOR SELECT
  USING (is_active = true);

-- giving_walls: admin full access
CREATE POLICY "giving_walls_admin_all"
  ON prayer_wall.giving_walls FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- donations: public SELECT on safe columns only (enforced below via column grants)
CREATE POLICY "donations_public_select"
  ON prayer_wall.donations FOR SELECT
  USING (true);

-- donations: NO public INSERT — only service_role (webhook edge function) may write
-- (no INSERT policy for anon or authenticated means all direct inserts are blocked)

-- donations: admin full access (for Donors tab — read email, amount, delete)
CREATE POLICY "donations_admin_all"
  ON prayer_wall.donations FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- webhook_events: no public access whatsoever
CREATE POLICY "webhook_events_deny_public"
  ON prayer_wall.webhook_events FOR SELECT
  USING (false);

-- webhook_events: admin read-only (for debugging in admin portal)
CREATE POLICY "webhook_events_admin_read"
  ON prayer_wall.webhook_events FOR SELECT
  TO authenticated
  USING (true);

-- ── 8. Column-level grants ────────────────────────────────────────────────────
-- anon can see name, amount, is_anonymous, donated_at only.
-- email, processor_ref, processor, email_opt_out are hidden.

REVOKE SELECT ON prayer_wall.donations FROM anon;
GRANT SELECT (id, wall_id, name, amount_cents, currency, is_anonymous, donated_at)
  ON prayer_wall.donations TO anon;

-- authenticated (admin) gets full column access
GRANT SELECT, UPDATE, DELETE ON prayer_wall.donations TO authenticated;

GRANT SELECT ON prayer_wall.giving_walls TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON prayer_wall.giving_walls TO authenticated;

-- service_role inherits ALL via migration 019 (ALTER DEFAULT PRIVILEGES)
-- webhook_events: no grant to anon; authenticated read-only
GRANT SELECT ON prayer_wall.webhook_events TO authenticated;

-- ── 9. Seed ───────────────────────────────────────────────────────────────────
-- Replace these UUIDs with real values after running migration.
-- HCA org UUID is '00000000-0000-0000-0000-000000000001' (from migration 001).

INSERT INTO prayer_wall.giving_walls (id, org_id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'HCA Giving Wall',
   'giving');

INSERT INTO prayer_wall.wall_theme (giving_wall_id)
  VALUES ('00000000-0000-0000-0000-000000000010');

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

---

## `types.ts` additions (manually maintained)

Following the project rule that `types.ts` is never auto-generated, add these blocks to `src/infrastructure/supabase/types.ts`:

```typescript
// Inside Database['prayer_wall']['Tables']:

giving_walls: {
  Row: {
    id: string
    org_id: string
    name: string
    slug: string
    is_active: boolean
    created_at: string
  }
  Insert: {
    id?: string
    org_id: string
    name: string
    slug: string
    is_active?: boolean
    created_at?: string
  }
  Update: {
    id?: string
    org_id?: string
    name?: string
    slug?: string
    is_active?: boolean
    created_at?: string
  }
  Relationships: []
}

donations: {
  Row: {
    id: string
    wall_id: string
    name: string
    is_anonymous: boolean
    amount_cents: number
    currency: string
    email: string | null
    processor: string
    processor_ref: string
    donated_at: string
    thank_you_sent: boolean
    email_opt_out: boolean
  }
  Insert: {
    id?: string
    wall_id: string
    name: string
    is_anonymous?: boolean
    amount_cents: number
    currency?: string
    email?: string | null
    processor?: string
    processor_ref: string
    donated_at?: string
    thank_you_sent?: boolean
    email_opt_out?: boolean
  }
  Update: {
    id?: string
    wall_id?: string
    name?: string
    is_anonymous?: boolean
    amount_cents?: number
    currency?: string
    email?: string | null
    processor?: string
    processor_ref?: string
    donated_at?: string
    thank_you_sent?: boolean
    email_opt_out?: boolean
  }
  Relationships: []
}

webhook_events: {
  Row: {
    id: string
    wall_id: string | null
    processor: string
    event_type: string
    processor_event_id: string
    raw_payload: Record<string, unknown>
    status: 'pending' | 'processed' | 'skipped' | 'failed'
    donation_id: string | null
    error_message: string | null
    received_at: string
    processed_at: string | null
  }
  Insert: {
    id?: string
    wall_id?: string | null
    processor?: string
    event_type: string
    processor_event_id: string
    raw_payload: Record<string, unknown>
    status?: 'pending' | 'processed' | 'skipped' | 'failed'
    donation_id?: string | null
    error_message?: string | null
    received_at?: string
    processed_at?: string | null
  }
  Update: {
    status?: 'pending' | 'processed' | 'skipped' | 'failed'
    donation_id?: string | null
    error_message?: string | null
    processed_at?: string | null
  }
  Relationships: []
}
```

Also add `giving_wall_id?: string | null` to `wall_theme` Row, Insert, and Update.

---

## Domain Layer

### Entity

```typescript
// giving-wall/src/domain/entities/Donation.ts

export interface Donation {
  id: string
  wallId: string
  name: string          // display name; 'Anonymous' if isAnonymous
  isAnonymous: boolean
  amountCents: number   // stored but not necessarily displayed on brick
  currency: string
  donatedAt: Date
}

// Used only by the webhook edge function — never crosses to the frontend
export interface CreateDonationData {
  wallId: string
  name: string
  isAnonymous: boolean
  amountCents: number
  currency: string
  email: string | null
  processor: string
  processorRef: string
}
```

`email` and `processorRef` are excluded from `Donation` because they are infrastructure concerns. The public-facing realtime payload never includes them (Supabase Realtime respects column-level grants).

### Repository interface

```typescript
// giving-wall/src/domain/repositories/IGivingWallRepository.ts

export interface IGivingWallRepository {
  findAllByWall(wallId: string): Promise<Donation[]>
  findById(id: string): Promise<Donation | null>
  create(data: CreateDonationData): Promise<Donation>
  setThankYouSent(id: string): Promise<void>
  setEmailOptOut(id: string): Promise<void>
}
```

### Use cases

```typescript
// GetGivingWall — public; returns Donation[] ordered by donated_at DESC
// GetDonors     — admin; raw DB rows including email, amount, thank_you_sent
// RecordDonation — called ONLY by the webhook edge function (service_role client)
//   1. Validates CreateDonationData fields (non-empty name, amount >= 0, valid processorRef)
//   2. Calls repo.create()
//   3. Does NOT invoke email — the edge function handles that directly
```

`RecordDonation` replaces `SubmitPrayerCommitment` conceptually but is far simpler: by the time it runs, payment is confirmed and name/email are already validated by Stripe. There is no category selection or form validation to perform.

---

## Stripe Webhook Edge Function

This is the most security-critical component. A flaw here could allow fake bricks to be created without payment, or allow replay attacks to create duplicate bricks.

### Endpoint

```
POST https://<ref>.supabase.co/functions/v1/giving-wall-webhook
```

Deployed with `verify_jwt: false` — Stripe cannot present a Supabase JWT. Authentication is entirely via HMAC signature verification.

### Required Supabase secrets

| Secret | Value source |
|---|---|
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Signing secret (`whsec_...`) |
| `SUPABASE_URL` | Auto-injected |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected |
| `GIVING_WALL_ID` | UUID of the `giving_walls` row (same as `VITE_WALL_ID` in the frontend) |

### Full implementation

```typescript
// supabase/functions/giving-wall-webhook/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Stripe HMAC signature verification ───────────────────────────────────────
// Stripe signs every webhook with HMAC-SHA256 using a per-endpoint secret.
// The signature is in the Stripe-Signature header as:
//   t=<timestamp>,v1=<hex-digest>[,v1=<hex-digest>...]
// We recompute: HMAC-SHA256(secret, "<timestamp>.<raw-body>") and compare.
// We also reject events older than 5 minutes to prevent replay attacks.

const STRIPE_TOLERANCE_SECONDS = 300; // 5 minutes

async function verifyStripeSignature(
  body: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  ) as Record<string, string>;

  const timestamp = parseInt(parts["t"] ?? "0", 10);
  const signatures = signatureHeader
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  // Reject stale events
  const ageSeconds = Math.floor(Date.now() / 1000) - timestamp;
  if (ageSeconds > STRIPE_TOLERANCE_SECONDS) {
    console.warn(`Stripe webhook too old: ${ageSeconds}s`);
    return false;
  }

  const signedPayload = `${timestamp}.${body}`;
  const keyData = new TextEncoder().encode(secret);
  const msgData = new TextEncoder().encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const computed = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((sig) => sig === computed);
}

// ─── Stripe event types we act on ─────────────────────────────────────────────
// Only payment_intent.succeeded creates a brick.
// All other event types are recorded in webhook_events but skipped.
// Add charge.refunded here in the future to handle brick removal on refund.

const ACTIONABLE_EVENTS = new Set(["payment_intent.succeeded"]);

// ─── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ── 1. Read raw body — MUST be raw string for HMAC verification ──────────────
  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  // ── 2. Environment ────────────────────────────────────────────────────────────
  const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const webhookSecret    = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const givingWallId     = Deno.env.get("GIVING_WALL_ID")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const db = supabase.schema("prayer_wall");

  // ── 3. Verify signature ───────────────────────────────────────────────────────
  const signatureValid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!signatureValid) {
    console.warn("Stripe webhook: invalid signature");
    // Do not insert into webhook_events — we can't trust the payload
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── 4. Parse event ────────────────────────────────────────────────────────────
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventType = (event["type"] as string) ?? "unknown";
  const processorEventId = (event["id"] as string) ?? "";

  // ── 5. Insert audit record — ALWAYS, regardless of event type or outcome ─────
  // If this insert fails (e.g. duplicate processor_event_id = already processed),
  // we return 200 immediately — Stripe has already delivered this event.
  const { error: auditError } = await db.from("webhook_events").insert({
    wall_id: givingWallId,
    processor: "stripe",
    event_type: eventType,
    processor_event_id: processorEventId,
    raw_payload: event,
    status: "pending",
  });

  if (auditError) {
    if (auditError.code === "23505") {
      // Unique violation on processor_event_id — Stripe delivered this twice
      console.log(`Duplicate Stripe event ${processorEventId} — idempotent skip`);
      return new Response(JSON.stringify({ received: true, skipped: "duplicate" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("Failed to insert webhook_event:", auditError.message);
    return new Response(JSON.stringify({ error: "Audit log failure" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── 6. Skip non-actionable event types ────────────────────────────────────────
  if (!ACTIONABLE_EVENTS.has(eventType)) {
    await db.from("webhook_events")
      .update({ status: "skipped", processed_at: new Date().toISOString() })
      .eq("processor_event_id", processorEventId);

    console.log(`Stripe event ${eventType} — skipped (not actionable)`);
    return new Response(JSON.stringify({ received: true, skipped: "not_actionable" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── 7. Extract PaymentIntent fields ───────────────────────────────────────────
  // Stripe's payment_intent.succeeded event structure:
  // event.data.object is the PaymentIntent object.
  // Metadata fields are set by the frontend when creating the PaymentIntent.

  const paymentIntent = (
    (event["data"] as Record<string, unknown>)?.["object"]
  ) as Record<string, unknown> | undefined;

  if (!paymentIntent) {
    await markFailed(db, processorEventId, "Missing event.data.object");
    return new Response(JSON.stringify({ error: "Malformed event" }), { status: 400 });
  }

  const processorRef  = paymentIntent["id"] as string;
  const amountCents   = paymentIntent["amount"] as number;           // Stripe stores in cents
  const currency      = (paymentIntent["currency"] as string) ?? "usd";
  const metadata      = (paymentIntent["metadata"] as Record<string, string>) ?? {};
  const receiptEmail  = (paymentIntent["receipt_email"] as string | null) ?? null;

  // Name comes from metadata set at PaymentIntent creation time by the frontend.
  // If missing, fall back to "Anonymous".
  const donorName     = (metadata["donor_name"] ?? "").trim() || "Anonymous";
  const isAnonymous   = metadata["is_anonymous"] === "true" || donorName === "Anonymous";

  // ── 8. Idempotency check at DB level ──────────────────────────────────────────
  // processor_ref has a UNIQUE constraint in donations — any duplicate insert
  // will throw a 23505 unique violation. We check explicitly for a cleaner error.
  const { data: existing } = await db
    .from("donations")
    .select("id")
    .eq("processor_ref", processorRef)
    .maybeSingle();

  if (existing) {
    await db.from("webhook_events")
      .update({
        status: "skipped",
        donation_id: existing.id,
        processed_at: new Date().toISOString(),
      })
      .eq("processor_event_id", processorEventId);

    console.log(`Donation for ${processorRef} already exists — idempotent skip`);
    return new Response(JSON.stringify({ received: true, skipped: "already_recorded" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── 9. Insert donation ────────────────────────────────────────────────────────
  const { data: donation, error: donationError } = await db
    .from("donations")
    .insert({
      wall_id:       givingWallId,
      name:          isAnonymous ? "Anonymous" : donorName,
      is_anonymous:  isAnonymous,
      amount_cents:  amountCents,
      currency:      currency,
      email:         receiptEmail,
      processor:     "stripe",
      processor_ref: processorRef,
    })
    .select("id")
    .single();

  if (donationError) {
    console.error("Failed to insert donation:", donationError.message);
    await markFailed(db, processorEventId, donationError.message);
    return new Response(JSON.stringify({ error: "Donation insert failed" }), { status: 500 });
  }

  // ── 10. Update audit record to processed ─────────────────────────────────────
  await db.from("webhook_events").update({
    status: "processed",
    donation_id: donation.id,
    processed_at: new Date().toISOString(),
  }).eq("processor_event_id", processorEventId);

  // ── 11. Fire thank-you email (fire-and-forget) ────────────────────────────────
  // We deliberately do NOT await this. The Stripe webhook must respond quickly.
  // If the email fails, thank_you_sent remains false and can be retried.
  supabase.functions.invoke("send-donation-thanks", {
    body: { donation_id: donation.id },
  }).catch((err: unknown) => {
    console.error("[send-donation-thanks] invoke failed:", err);
  });

  console.log(
    `giving-wall-webhook: processed payment_intent=${processorRef} ` +
    `donation=${donation.id} amount=${amountCents}${currency}`,
  );

  return new Response(
    JSON.stringify({ received: true, donation_id: donation.id }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});

// ─── Helper ────────────────────────────────────────────────────────────────────

async function markFailed(
  // deno-lint-ignore no-explicit-any
  db: any,
  processorEventId: string,
  message: string,
) {
  await db.from("webhook_events").update({
    status: "failed",
    error_message: message,
    processed_at: new Date().toISOString(),
  }).eq("processor_event_id", processorEventId);
}
```

### Frontend: creating the PaymentIntent

The frontend does **not** complete the donation — it only initiates the PaymentIntent with Stripe and hands off. The `donor_name` and `is_anonymous` metadata fields are what the webhook uses to populate the brick.

```typescript
// In PaymentModal — pseudocode (actual Stripe.js integration TBD by processor choice)

const paymentIntent = await stripe.createPaymentIntent({
  amount: selectedAmountCents,    // e.g. 5000 for $50
  currency: 'usd',
  receipt_email: email,
  metadata: {
    donor_name: name,             // "Jane Smith"
    is_anonymous: String(isAnonymous),  // "false"
    wall_id: GIVING_WALL_ID,      // for webhook routing if multi-wall
  },
})
// Mount Stripe Payment Element with paymentIntent.client_secret
// On payment completion, Stripe fires the webhook — browser does nothing more
```

The browser never calls any Supabase endpoint on payment completion. The Realtime subscription is what makes the brick appear.

---

## `send-donation-thanks` Edge Function

```typescript
// supabase/functions/send-donation-thanks/index.ts
// verify_jwt: true — only called by giving-wall-webhook (service_role JWT)
// Sends a thank-you email and updates donations.thank_you_sent

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { emailShell, greeting, paragraph, closing, BRAND }
  from "../_shared/email-layout.ts";

Deno.serve(async (req: Request) => {
  const { donation_id } = await req.json() as { donation_id: string };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const db = supabase.schema("prayer_wall");

  // Fetch donation
  const { data: donation } = await db
    .from("donations")
    .select("id, wall_id, name, amount_cents, currency, email, is_anonymous")
    .eq("id", donation_id)
    .maybeSingle();

  if (!donation || !donation.email || donation.is_anonymous) {
    // No email to send — mark as sent to stop retries
    await db.from("donations").update({ thank_you_sent: true }).eq("id", donation_id);
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const amountFormatted = new Intl.NumberFormat("en-US", {
    style: "currency", currency: donation.currency.toUpperCase(),
  }).format(donation.amount_cents / 100);

  const unsubscribeUrl = `${Deno.env.get("APP_URL")}/unsubscribe?id=${donation_id}`;

  const bodyHtml = `
    ${greeting(donation.name)}
    ${paragraph(
      `Thank you for your generous gift of <strong>${amountFormatted}</strong> to ` +
      `${BRAND.orgFull}. Your support makes a lasting difference.`
    )}
    ${paragraph(
      "Your name has been added to the HCA Giving Wall. " +
      "We are grateful for your partnership with our school."
    )}
    ${closing()}
  `;

  const html = emailShell({
    title: `Thank you for your gift to ${BRAND.orgFull}`,
    bodyHtml,
    unsubscribeUrl,
  });

  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const fromEmail    = Deno.env.get("FROM_EMAIL")!;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${BRAND.fromName} <${fromEmail}>`,
      to: [donation.email],
      subject: `Thank you for your gift to ${BRAND.orgFull}`,
      html,
      tags: [{ name: "type", value: "donation_thank_you" }],
    }),
  });

  const resendData = await res.json() as { id?: string; message?: string };

  // Log to email_logs
  await db.from("email_logs").insert({
    wall_id: donation.wall_id,       // NOTE: this is giving_wall_id semantically;
                                     // email_logs.wall_id is TEXT — no FK issue
    commitment_id: null,
    email: donation.email,
    status: res.ok ? "sent" : "failed",
    email_type: "donation_thank_you",
    resend_message_id: resendData.id ?? null,
  });

  await db.from("donations").update({ thank_you_sent: true }).eq("id", donation_id);

  return new Response(JSON.stringify({ sent: res.ok }), { status: 200 });
});
```

**Note on `email_logs.wall_id`:** The `email_logs` table has a FK to `prayer_wall.walls(id)`. For giving wall emails, either: (a) make the column nullable, (b) make it a `TEXT` field with no FK (current shape already works this way — check migration 001 to verify), or (c) add a separate `giving_wall_id` column. This needs a follow-up migration if the FK constraint blocks inserts.

---

## Realtime Hook

```typescript
// giving-wall/src/presentation/hooks/useRealtimeDonations.ts
import { useEffect } from 'react'
import type { Donation } from '../../domain/entities/Donation'
import { useContainer } from '../context/AppContext'

interface RealtimeDonationPayload {
  id: string
  wall_id: string
  name: string
  amount_cents: number
  currency: string
  is_anonymous: boolean
  donated_at: string
  // email, processor_ref NOT included — Supabase respects column-level grants
}

function payloadToDonation(row: RealtimeDonationPayload): Donation {
  return {
    id: row.id,
    wallId: row.wall_id,
    name: row.is_anonymous ? 'Anonymous' : row.name,
    isAnonymous: row.is_anonymous,
    amountCents: row.amount_cents,
    currency: row.currency,
    donatedAt: new Date(row.donated_at),
  }
}

export function useRealtimeDonations(
  wallId: string,
  onNewDonation: (d: Donation) => void,
) {
  const { supabase } = useContainer()

  useEffect(() => {
    const channel = supabase
      .channel(`giving-wall-${wallId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'prayer_wall',
          table: 'donations',
          filter: `wall_id=eq.${wallId}`,
        },
        (payload) => {
          onNewDonation(payloadToDonation(payload.new as unknown as RealtimeDonationPayload))
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [supabase, wallId, onNewDonation])
}
```

---

## App Structure (monorepo)

The giving wall is a second Vite app in the same repo. Migrations and edge functions remain in the shared `supabase/` directory.

```
prayer-wall/                          ← root
  src/                                ← Prayer Wall (existing, untouched)
  supabase/
    migrations/
      ...019_grant_service_role_schema.sql
      022_giving_wall.sql             ← NEW
    functions/
      _shared/
        email-layout.ts               ← shared; add giving wall copy here
      send-confirmation/              ← existing
      send-reminders/                 ← existing
      giving-wall-webhook/            ← NEW
        index.ts
      send-donation-thanks/           ← NEW
        index.ts

  giving-wall/                        ← NEW Vite app
    index.html
    vite.config.ts
    package.json
    tsconfig.json
    .env.example                      ← VITE_WALL_ID, VITE_ORG_ID, etc.

    src/
      domain/
        entities/
          Donation.ts
        repositories/
          IGivingWallRepository.ts

      application/
        use-cases/
          GetGivingWall.ts
          GetDonors.ts

      infrastructure/
        container.ts
        supabase/
          client.ts                   ← identical pattern to prayer wall
          types.ts                    ← manually maintained; giving_walls + donations + webhook_events
        repositories/
          SupabaseGivingWallRepository.ts
          MockGivingWallRepository.ts
        mock/
          MockRealtimeClient.ts       ← copy from prayer wall
        theme.ts                      ← copy from prayer wall (identical)

      presentation/
        context/
          AppContext.tsx              ← copy; wire IGivingWallRepository
        hooks/
          useGivingWall.ts            ← mirrors usePrayerWall
          useRealtimeDonations.ts     ← mirrors useRealtimePrayers
        pages/
          WallPage.tsx                ← giving wall skin; no category section
          AdminPage.tsx               ← Donors / Assets / Theme tabs
          UnsubscribePage.tsx         ← copy; acts on donations.email_opt_out
        components/
          GivingWallGrid.tsx          ← thin wrapper over PrayerWallGrid
          DonationBrick.tsx           ← mirrors PrayerBrick; Donation entity
          GivingCtaBrick.tsx          ← mirrors CtaBrick; different icon
          PaymentModal.tsx            ← Stripe Payment Element
          DonorsAdmin.tsx             ← read-only donor table for admin
          ui/                         ← copy Modal, Input, Button
        utils/
          formatCurrency.ts           ← Intl.NumberFormat helper

      index.css                       ← copy prayer wall index.css
      main.tsx                        ← copy; different VITE_ASSETS_BUCKET
      App.tsx
```

### `vite.config.ts` (giving wall)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname),           // giving-wall/ is the root
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist'),
  },
})
```

---

## Env Vars

### Giving Wall frontend (Railway service)

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Same as prayer wall |
| `VITE_SUPABASE_ANON_KEY` | Same as prayer wall |
| `VITE_WALL_ID` | UUID of the `giving_walls` row (NOT the `walls` row) |
| `VITE_ORG_ID` | HCA org UUID (same) |
| `VITE_ORG_NAME` | `Heritage Christian Academy` |
| `VITE_ASSETS_BUCKET` | `giving-assets` |
| `VITE_USE_MOCK` | `true` for local dev |

### Supabase edge function secrets (in addition to existing)

| Secret | Description |
|---|---|
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Stripe Dashboard → Webhooks |
| `GIVING_WALL_ID` | Same UUID as `VITE_WALL_ID` above |

---

## Admin Portal (Giving Wall)

| Tab | Implementation | Notes |
|---|---|---|
| **Donors** | New `DonorsAdmin.tsx` | Table: name, formatted amount, date, thank-you sent, delete button |
| **Assets** | Copy `AssetAdmin.tsx` verbatim | Points at `giving-assets` bucket |
| **Theme** | Copy `ThemeAdmin.tsx` verbatim | Reads/writes `wall_theme` by `giving_wall_id` |

`DonorsAdmin` is read-only except for deletion. The source of truth for names and amounts is the processor — admin should not be able to edit them.

---

## Payment Processor Abstraction

The webhook function is written Stripe-first, but the `processor` column on `donations` and `webhook_events` allows future processors to coexist. When a second processor (Justify, Gettrx) is added:

1. Create a second edge function `giving-wall-webhook-justify/index.ts` with that processor's signature scheme.
2. Register a second webhook endpoint in that processor's dashboard.
3. The donation insert sets `processor = 'justify'`.
4. Everything else (Realtime, brick display, admin, email) is processor-agnostic.

Alternatively, a single webhook function can detect the processor by checking for the presence of processor-specific headers and dispatching accordingly.

---

## Webhook Auditability — What `webhook_events` Enables

| Question | Answer from `webhook_events` |
|---|---|
| Did Stripe actually send this event? | Query `WHERE processor_event_id = 'evt_...'` |
| Was a payment processed but no brick appeared? | Find `status = 'failed'` or `status = 'processed'` with no matching Realtime event |
| Did Stripe send the same event twice? | Find duplicate `processor_event_id` — second insert returns 23505, first row shows `status = 'skipped'` |
| What did Stripe send, exactly? | `raw_payload JSONB` — full event stored verbatim |
| How long did processing take? | `processed_at - received_at` |
| Which donation did this event produce? | `donation_id` FK |
| Did any events fail processing? | `WHERE status = 'failed'` → `error_message` explains why |

This table is the audit trail that allows you to answer Ivy's question "why didn't that donation appear on the wall?" without calling Stripe support.

---

## Implementation Sequence

| Step | Work | Notes |
|---|---|---|
| 1 | Run migration `022` | Schema + RLS + Realtime + seed |
| 2 | Update `types.ts` | Add `giving_walls`, `donations`, `webhook_events` types |
| 3 | `Donation` entity + `IGivingWallRepository` | Domain layer; no dependencies |
| 4 | `MockGivingWallRepository` | In-memory; for `VITE_USE_MOCK=true` |
| 5 | `SupabaseGivingWallRepository` | Supabase client; column-restricted SELECT for `findAllByWall` |
| 6 | `container.ts` (giving wall) | Wire mock/Supabase based on `VITE_USE_MOCK` |
| 7 | `giving-wall-webhook` edge function | Deploy to Supabase; register URL in Stripe Dashboard |
| 8 | `send-donation-thanks` edge function | Deploy; verify `email_logs` FK situation |
| 9 | `GivingWallGrid` + `DonationBrick` + `useGivingWall` + `useRealtimeDonations` | Wall renders; bricks animate in on Realtime |
| 10 | `PaymentModal` — placeholder | "Payment coming soon" so wall is deployable now |
| 11 | `WallPage` (giving skin) | No categories section; same theme vars |
| 12 | Admin portal | Donors / Assets / Theme tabs |
| 13 | Stripe Payment Element integration | Actual payment flow in `PaymentModal` |
| 14 | End-to-end test | Pay via Stripe test mode → brick appears → thank-you email arrives |

---

## Open Questions

| Question | Options | Owner |
|---|---|---|
| Payment processor | Stripe (recommended; best webhook docs + HMAC) · Justify · Gettrx | Terry to evaluate; Ivy researching Justify/Gettrx |
| Brick label | Name only · Name + amount · Name + level badge | Ivy preference |
| Anonymous bricks | Show "Anonymous" brick · Suppress entirely | Ivy preference |
| `email_logs.wall_id` FK | Make nullable · Add `giving_wall_id` column · Remove FK | Needs follow-up migration |
| Refunds | Remove brick on `charge.refunded` event? | Business decision |
| Goal display | Show progress toward a giving goal ($50,000)? | Future feature |
| Milestone brick styles | Larger/different brick style for $500+ gifts? | Future feature |

---

## References

- `supabase/migrations/001_initial_schema.sql` — base schema shape
- `supabase/migrations/004_email_rhythms.sql` — cadence + `set_updated_at()` trigger pattern
- `supabase/migrations/008_wall_theme.sql` — `wall_theme` structure
- `supabase/migrations/018_email_logs_type.sql` — CHECK constraint extension pattern
- `supabase/migrations/019_grant_service_role_schema.sql` — service_role grants (covers new tables via ALTER DEFAULT PRIVILEGES)
- `supabase/functions/send-confirmation/index.ts` — edge function pattern to follow
- `supabase/functions/_shared/email-layout.ts` — shared email branding
- `src/infrastructure/container.ts` — repository wiring pattern
- `src/presentation/components/PrayerWallGrid.tsx` — grid to reuse
- `src/presentation/hooks/useRealtimePrayers.ts` — realtime pattern
- `src/infrastructure/supabase/types.ts` — manually maintained types
- `docs/meetings/2026-08-05-hca-ivy-review.md` — source of requirements
- `docs/decisions/003-mock-vs-supabase-repos.md` — never use Mock in production branch
