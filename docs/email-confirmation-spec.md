# Email Confirmation — Technical Requirements Specification

**Feature:** Instant confirmation email on brick/stone selection  
**Status:** Planning  
**Created:** 2026-07-17  

---

## Business & Architectural Overview

### Why this feature matters

When a person places their name on the prayer wall they are making a covenant act — committing to intercede on behalf of the community's needs. The digital experience must honour that moment with immediate, meaningful feedback. Leaving the user without a confirmation email after form submission:

- Creates doubt that the submission was received
- Misses the highest-engagement moment (the user is actively thinking about prayer right now)
- Provides no durable record of what the person committed to pray over

Two emails dispatched at the moment of commitment solve all three problems simultaneously:

1. **Confirmation email** — a brief, warm acknowledgement that their stone has been placed; sets expectations for future reminder cadence
2. **Prayer & meditation summary email** — delivers every prayer and meditation text tied to their selected categories in a single, well-formatted devotional email; this is the content they will actually use to pray

### Architectural position

This feature sits at the intersection of three systems that already exist in the codebase and must be composed rather than rebuilt:

| System | Role in this feature |
|---|---|
| **React frontend (Railway)** | Collects user input; invokes the Edge Function after a successful DB insert |
| **Supabase** | Stores the commitment; runs the Edge Function; enforces RLS; writes the audit log |
| **Resend** | Delivers the two transactional emails to the user's inbox |

The deliberate design choice is to keep email dispatch **event-driven and synchronous from the frontend's perspective** — the form resolves immediately when the DB insert succeeds; the Edge Function call is fire-and-forget from the user's standpoint. This means there is no polling, no webhook back to the client, and no blocking the success UX flow on email delivery.

The `send-confirmation` Edge Function is intentionally separate from the existing `send-reminders` function. The two have different trigger models (user-initiated vs. scheduled), different data access patterns (single commitment vs. all due commitments), and different failure semantics. Conflating them would create a brittle, dual-responsibility function.

### Relationship to the existing email rhythm system

```
                    ┌─────────────────────────────────────────────────────┐
                    │              Email System — Two Paths                │
                    └─────────────────────────────────────────────────────┘

PATH A — Commitment event (this feature)          PATH B — Scheduled rhythms (existing)
─────────────────────────────────────             ────────────────────────────────────
Trigger: user submits commitment form             Trigger: pg_cron fires hourly
Function: send-confirmation                       Function: send-reminders
Audience: one person, one time                    Audience: all active commitments on due walls
Content: all meditations for their categories     Content: one meditation per category per cadence
Timing: immediate (< 5 s after form submit)       Timing: daily / weekly / monthly per rhythm config
Log type: confirmation + summary                  Log type: reminder
```

Both paths write to `prayer_wall.email_logs` and both deliver via Resend. No changes are required to `send-reminders` or its pg_cron schedule.

---

## Assumptions

| # | Assumption |
|---|---|
| A1 | The email delivery provider remains **Resend** (already configured for `send-reminders`). No new vendor is introduced. |
| A2 | The existing Supabase Edge Function secrets `RESEND_API_KEY`, `FROM_EMAIL`, and `APP_URL` are already set and apply to the new function without modification. |
| A3 | A dedicated Edge Function `send-confirmation` is created. Concerns are kept separate from `send-reminders`. |
| A4 | The frontend calls the new Edge Function immediately after a successful `SubmitPrayerCommitment` use-case execution — not via a database trigger — because the frontend already holds the `commitment_id` at that point and a DB trigger would require service-role privileges that are not available on the client side. |
| A5 | The summary email includes **all** active meditations for the selected categories, not a random one. The `send-reminders` rhythm handles the per-cadence rotation; this is a one-time, complete reference of everything the user signed up to pray over. |
| A6 | Meditations within each category are ordered by `display_order ASC`. Categories are ordered by `display_order ASC` from `message_categories`. |
| A7 | No schema changes are needed beyond adding an `email_type` column to `prayer_wall.email_logs`. All other required tables (`commitments`, `commitment_categories`, `message_categories`, `prayer_meditations`) are already in place. |
| A8 | The Edge Function uses `verify_jwt: true`. The caller (Supabase JS client in the frontend) passes the anon JWT automatically via `supabase.functions.invoke()`. Inside the function, a service-role client performs privileged reads (e.g., the `email` column, which is hidden from the anon role). |
| A9 | Idempotency / replay protection (preventing a second send if the frontend retries) is deferred to a follow-on milestone. |
| A10 | The two-email design (confirmation then summary, sequentially in one function invocation) is preferred over a single combined email. See [Design Decision #1](#design-decision-1--one-email-or-two). |

---

## Design Decision #1 — One email or two?

**Decision: two separate emails, sent sequentially in one Edge Function invocation.**

| Option | Pros | Cons |
|---|---|---|
| Single combined email | One Resend API call; one inbox entry | Subject line serves two purposes; confirmation UX is diluted; email becomes very long |
| **Two separate emails (chosen)** | Clear, purpose-driven subjects; short confirmation arrives first; detailed devotional summary follows naturally | Two Resend API calls per commitment (~200 ms additional latency inside the function) |

Email #1 subject: *"Your prayer stone has been placed"* — arrives first, short, affirming.  
Email #2 subject: *"Your prayers & meditations"* — arrives seconds later, full devotional content.

Both emails are sent inside the same Edge Function execution so there is no scheduling gap or cron dependency between them.

---

## Supabase Components

This section enumerates every Supabase primitive involved and how each is used.

### 1. PostgreSQL — `prayer_wall` schema

The following tables are read or written during a confirmation send:

#### `prayer_wall.commitments`
- **Read** by the Edge Function (service-role) to retrieve `id`, `name`, `email`, `wall_id` for the newly created commitment.
- The `email` column is excluded from the anon role by a column-level grant in `001_initial_schema.sql`. The service-role client bypasses RLS and column restrictions.
- **Written** to by the frontend (anon role, PostgREST) during the commitment insert — this happens before the Edge Function is called.

#### `prayer_wall.commitment_categories`
- **Read** by the Edge Function to resolve which `category_id` values belong to the new commitment.
- Join path: `commitment_categories.commitment_id = commitments.id`

#### `prayer_wall.message_categories`
- **Read** by the Edge Function to retrieve `name` and `display_order` for each category, enabling labelled sections in Email #2.
- Ordered by `display_order ASC`.

#### `prayer_wall.prayer_meditations`
- **Read** by the Edge Function to retrieve all `body` values for each category where `is_active = true`.
- Ordered by `display_order ASC` per category.
- All active meditations are included (see Assumption A5).

#### `prayer_wall.email_logs`
- **Written** twice (once per email) at the conclusion of each Resend API call, regardless of success or failure.
- Requires the `email_type` column added in migration `018_email_logs_type.sql`.

**Column written per row:**

| Column | Value |
|---|---|
| `wall_id` | Copied from commitment row |
| `commitment_id` | UUID of the new commitment |
| `email` | Recipient address |
| `status` | `sent` or `failed` |
| `email_type` | `confirmation` (Email #1) or `summary` (Email #2) |
| `resend_message_id` | `id` field from Resend response, or `null` on failure |
| `sent_at` | Default `now()` |

### 2. PostgREST API

The **frontend** uses PostgREST (Supabase's auto-generated REST layer) to insert the commitment and its categories before the Edge Function is called. This is the existing flow in `SubmitPrayerCommitment.ts` and the `IPrayerRepository` implementation — no changes here.

PostgREST is **not** used inside the Edge Function. The function uses the Supabase JS client with the service-role key, which makes direct SQL queries to Postgres via the internal connection pool, bypassing PostgREST entirely.

### 3. Edge Functions (Deno runtime)

#### New function: `send-confirmation`

| Property | Value |
|---|---|
| Path | `supabase/functions/send-confirmation/index.ts` |
| Runtime | Deno (TypeScript) |
| CPU time limit | 2 seconds (Supabase free tier) |
| Request idle timeout | 150 seconds |
| `verify_jwt` | `true` — anon JWT from frontend required |
| Trigger | HTTP POST from React frontend immediately after DB insert |
| Auth inside function | Service-role client (`SUPABASE_SERVICE_ROLE_KEY`) for privileged DB reads |

**Execution budget:** This function makes ~4 sequential DB queries + 2 Resend HTTP calls. Expected wall-clock time is well under 5 seconds for typical meditation counts, comfortably within the 150-second idle timeout.

#### Existing function: `send-reminders` (unchanged)

No modifications. It continues to fire on the pg_cron schedule and delivers one meditation per category per cadence cycle.

### 4. Row Level Security (RLS)

The new Edge Function operates with the service-role key, which bypasses RLS entirely. No new RLS policies are required. The existing policies remain:

- `commitments_public_insert` — used by the frontend to insert the row before calling the function
- `email_logs_deny_all` — prevents anon/authenticated roles from reading logs; the service-role client writes directly

### 5. Supabase JS Client (inside the Edge Function)

```typescript
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "prayer_wall" } },
);
```

The `db.schema` option scopes all table references to `prayer_wall` without needing to prefix every query, matching the pattern established in `send-reminders`.

### 6. Supabase JS Client (inside the React frontend)

The frontend invokes the Edge Function using the existing `supabase` client instance (anon key). The Supabase JS client automatically attaches the anon JWT as the `Authorization: Bearer` header:

```typescript
const { error } = await supabase.functions.invoke('send-confirmation', {
  body: { commitment_id: newCommitment.id },
})
if (error) console.error('[send-confirmation]', error)
```

### 7. Environment Secrets (Edge Function)

All secrets are configured once in the Supabase Dashboard under **Project Settings → Edge Functions → Secrets** and are shared across functions. No new secrets are needed for this feature.

| Secret | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | Both functions | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Both functions | Privileged DB access |
| `RESEND_API_KEY` | Both functions | Authenticates Resend API calls |
| `FROM_EMAIL` | Both functions | Sender address (e.g. `prayer@heritage.edu`) |
| `APP_URL` | Both functions | Base URL for unsubscribe links |

### 8. Supabase Realtime (no change)

Realtime is already publishing `prayer_wall.commitments` inserts to the wall display. This feature adds no Realtime interaction — the email confirmation is entirely independent of the live wall update.

### 9. Migration: `018_email_logs_type.sql`

The only schema change required:

```sql
-- 018_email_logs_type.sql
ALTER TABLE prayer_wall.email_logs
  ADD COLUMN IF NOT EXISTS email_type TEXT NOT NULL DEFAULT 'reminder'
    CHECK (email_type IN ('reminder', 'confirmation', 'summary'));
```

- Default `'reminder'` ensures all existing rows and future `send-reminders` logs remain valid without code changes to that function.
- The `send-confirmation` function explicitly passes `'confirmation'` and `'summary'` when inserting.

---

## Resend Infrastructure

### Account and domain configuration

Resend delivers transactional email via a simple REST API. The following infrastructure must be in place (most of this is already done for `send-reminders`):

#### Sender domain verification

The `FROM_EMAIL` domain (e.g. `heritage.edu`) must be verified in the Resend dashboard under **Domains**. This requires three DNS records to be added at the domain registrar:

| Record type | Name | Value | Purpose |
|---|---|---|---|
| `TXT` | `resend._domainkey.<domain>` | DKIM public key (provided by Resend) | Authenticates email as coming from your domain |
| `TXT` | `@` or `<domain>` | SPF record including `include:amazonses.com` | Authorises Resend's sending servers |
| `MX` | `bounce.<domain>` | Resend bounce MX (provided by Resend) | Routes bounce notifications back to Resend |

Without domain verification, emails are sent from Resend's shared `@resend.dev` domain and are more likely to land in spam.

#### API key

The `RESEND_API_KEY` is a project-level key created in Resend dashboard → **API Keys**. It is stored as a Supabase Edge Function secret and never exposed to the browser. The same key used by `send-reminders` is reused — no new key is needed.

#### Free tier capacity

| Limit | Value | Headroom for this use case |
|---|---|---|
| Monthly sends | 3,000 | Covers ~1,500 new commitments/month (2 emails each) |
| Daily sends | 100 | Covers 50 new commitments/day |
| Rate limit | 2 requests/second | Sequential sends (2 per function call) are well within this |

For a typical church deployment these limits are not a concern. If the wall grows large, upgrading Resend to the $20/month plan raises limits to 50,000/month.

### API call structure

Each email is sent via a single HTTP POST to Resend's v1 emails endpoint:

```
POST https://api.resend.com/emails
Authorization: Bearer <RESEND_API_KEY>
Content-Type: application/json

{
  "from": "Prayer Wall <prayer@heritage.edu>",
  "to": ["user@example.com"],
  "subject": "...",
  "html": "...",
  "tags": [
    { "name": "type", "value": "confirmation" }
  ]
}
```

The `tags` field attaches a custom label to the send in the Resend dashboard, making it easy to filter confirmation emails from reminder emails in Resend's analytics and log views without relying solely on `email_logs`.

### Resend response handling

Resend returns:

```json
{ "id": "re_xxxxxxxxxxxxxx" }   // success (HTTP 200)
{ "message": "...", "name": "validation_error" }  // failure (HTTP 4xx/5xx)
```

The `id` from a successful response is stored in `email_logs.resend_message_id`. This ID can be used in the Resend dashboard to look up the exact delivery event, bounce detail, or spam report for any individual send.

### Delivery lifecycle in Resend

After `send-confirmation` POSTs to Resend, the following events occur inside Resend's infrastructure — all of which are visible in the Resend dashboard under **Emails**:

1. **Queued** — Resend accepts the request and queues the message
2. **Sent** — Resend hands off to Amazon SES (Resend's delivery infrastructure)
3. **Delivered** — receiving mail server confirms acceptance
4. **Opened** / **Clicked** — tracked via Resend's pixel if enabled (off by default)
5. **Bounced** / **Complained** — handled by Resend; bounce webhook can be configured (see [Future Enhancements](#future-enhancements))

### Unsubscribe compliance

CAN-SPAM and GDPR require a functional unsubscribe mechanism in every commercial/transactional email. The existing `unsubscribe` Edge Function (`supabase/functions/unsubscribe/index.ts`) sets `reminder_active = false` on a commitment. The unsubscribe URL embedded in each email is:

```
{APP_URL}/unsubscribe?id={commitment_id}
```

This URL is already handled by `UnsubscribePage.tsx` in the frontend, which calls the `unsubscribe` Edge Function. **No new unsubscribe infrastructure is needed.** Both confirmation emails link to this same endpoint.

---

## End-to-End Technical Flow

The following traces every system interaction from button click to email delivery.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. USER — CommitmentPage.tsx                                                │
│    User clicks an open brick/stone tile                                     │
│    → Modal opens (CommitmentForm.tsx)                                       │
│    → User enters name, email, selects 1–3 prayer categories                │
│    → User clicks "Commit to pray"                                           │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. FRONTEND — SubmitPrayerCommitment use-case                               │
│    Validates: name present, valid email, 1–3 valid category IDs             │
│    → supabase.from('commitments').insert(...)                               │
│       [anon JWT, PostgREST, prayer_wall schema]                             │
│       Writes: name, email, wall_id, committed_at, reminder_active=true     │
│    → supabase.from('commitment_categories').insert([...categoryRows])       │
│       Writes: one row per selected category                                 │
│    Returns: new Prayer entity including id (commitment UUID)                │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │  DB inserts confirmed
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. FRONTEND — CommitmentForm.tsx (fire-and-forget)                          │
│    supabase.functions.invoke('send-confirmation', {                         │
│      body: { commitment_id: newPrayer.id }                                  │
│    })                                                                       │
│    → Supabase JS client attaches anon JWT as Authorization header           │
│    → HTTP POST to Supabase Edge Function runtime                            │
│    Modal closes immediately; user sees wall update via Realtime             │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. SUPABASE EDGE FUNCTION — send-confirmation (Deno runtime)                │
│                                                                             │
│  4a. CORS preflight check                                                   │
│      OPTIONS → return 200 with Access-Control headers                       │
│                                                                             │
│  4b. JWT verification                                                       │
│      Supabase runtime validates anon JWT automatically (verify_jwt: true)   │
│      Rejects with 401 if JWT is absent or invalid                           │
│                                                                             │
│  4c. Input validation                                                       │
│      Parse JSON body → extract commitment_id                                │
│      Validate UUID format (regex or crypto.randomUUID shape check)         │
│      Return 400 if missing or malformed                                     │
│                                                                             │
│  4d. Create service-role Supabase client                                    │
│      createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,                  │
│        { db: { schema: 'prayer_wall' } })                                   │
│      Bypasses RLS; can read email column and all restricted tables          │
│                                                                             │
│  4e. Query #1 — fetch commitment                                            │
│      SELECT id, name, email, wall_id                                        │
│      FROM prayer_wall.commitments                                           │
│      WHERE id = $commitment_id                                              │
│      → 404 if not found                                                     │
│                                                                             │
│  4f. Query #2 — fetch categories                                            │
│      SELECT mc.id, mc.name, mc.display_order                                │
│      FROM prayer_wall.commitment_categories cc                              │
│      JOIN prayer_wall.message_categories mc ON mc.id = cc.category_id      │
│      WHERE cc.commitment_id = $commitment_id                                │
│      ORDER BY mc.display_order ASC                                          │
│                                                                             │
│  4g. Query #3 — fetch meditations for all categories (one query)            │
│      SELECT pm.category_id, pm.body, pm.display_order                      │
│      FROM prayer_wall.prayer_meditations pm                                 │
│      WHERE pm.category_id = ANY($categoryIds)                               │
│        AND pm.is_active = true                                              │
│      ORDER BY pm.category_id, pm.display_order ASC                         │
│      Group results into Map<category_id, body[]>                            │
│                                                                             │
│  4h. Build Email #1 HTML — confirmation template                            │
│      Short, branded, warm tone                                              │
│      Includes unsubscribe URL: {APP_URL}/unsubscribe?id={commitment_id}    │
│                                                                             │
│  4i. Send Email #1 to Resend                                                │
│      POST https://api.resend.com/emails                                     │
│      from: "Prayer Wall <{FROM_EMAIL}>"                                     │
│      to: [commitment.email]                                                 │
│      subject: "Your prayer stone has been placed"                          │
│      html: <confirmation template>                                          │
│      tags: [{ name: "type", value: "confirmation" }]                        │
│      → await response; capture resend_message_id                            │
│                                                                             │
│  4j. Insert Email #1 log row                                                │
│      INSERT INTO prayer_wall.email_logs                                     │
│      (wall_id, commitment_id, email, status, email_type, resend_message_id) │
│      VALUES ($wall_id, $id, $email, 'sent'|'failed',                        │
│              'confirmation', $resend_id)                                    │
│                                                                             │
│  4k. Build Email #2 HTML — prayer summary template                          │
│      One labelled section per category                                      │
│      Each meditation body as a <p> with paragraph-break spacing             │
│      Categories separated by <hr>                                          │
│      Fallback text if no active meditations exist                           │
│      Includes unsubscribe URL                                               │
│                                                                             │
│  4l. Send Email #2 to Resend                                                │
│      POST https://api.resend.com/emails                                     │
│      subject: "Your prayers & meditations"                                  │
│      html: <summary template>                                               │
│      tags: [{ name: "type", value: "summary" }]                             │
│      → await response; capture resend_message_id                            │
│                                                                             │
│  4m. Insert Email #2 log row                                                │
│      email_type = 'summary'                                                 │
│                                                                             │
│  4n. Return HTTP 200                                                        │
│      { sent: 2, failed: 0 } or partial counts                               │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. RESEND — delivery pipeline                                               │
│    Queues → hands off to Amazon SES infrastructure                          │
│    Email #1 arrives in user inbox: "Your prayer stone has been placed"      │
│    Email #2 arrives seconds later: "Your prayers & meditations"             │
│    Both events visible in Resend dashboard under Emails                     │
│    Bounce / complaint events can be routed to webhook (future)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Changes

### Migration `018_email_logs_type.sql`

```sql
-- 018_email_logs_type.sql
-- Add email_type to distinguish confirmation sends from scheduled reminders.
-- Default 'reminder' keeps all existing rows and send-reminders inserts valid.

ALTER TABLE prayer_wall.email_logs
  ADD COLUMN IF NOT EXISTS email_type TEXT NOT NULL DEFAULT 'reminder'
    CHECK (email_type IN ('reminder', 'confirmation', 'summary'));
```

No other schema changes are required.

---

## New Edge Function: `send-confirmation`

**Path:** `supabase/functions/send-confirmation/index.ts`

### HTTP contract

```
POST /functions/v1/send-confirmation
Authorization: Bearer <SUPABASE_ANON_KEY>   ← injected automatically by supabase.functions.invoke()
Content-Type: application/json

Request body:
{
  "commitment_id": "<uuid>"
}

Success response (HTTP 200):
{
  "sent": 2,
  "failed": 0
}

Partial failure (HTTP 200, emails attempted):
{
  "sent": 1,
  "failed": 1,
  "errors": ["Resend error for summary: 422 ..."]
}

Hard failure (HTTP 4xx / 5xx):
{
  "error": "<message>"
}
```

### Auth model

- **`verify_jwt: true`** — Supabase edge runtime validates the JWT on every non-OPTIONS request before the handler runs. An anon JWT (from `supabase.createClient()` in the frontend) is sufficient.
- **Service-role client inside the function** — used for all DB reads. The anon JWT from the caller is not forwarded to the DB client; it is only used for function-level auth.
- This pattern ensures the `email` column and other anon-restricted data is readable inside the function while remaining inaccessible to the browser.

### Step-by-step logic

1. **CORS preflight** — `OPTIONS` returns `200` with `Access-Control-Allow-Origin: *` and required headers.
2. **Input parse** — read `commitment_id` from JSON body; return `400` if absent or not a valid UUID shape.
3. **Fetch commitment** — service-role client, `prayer_wall.commitments`; return `404` if no row found.
4. **Fetch categories** — join `commitment_categories → message_categories`, `ORDER BY display_order ASC`.
5. **Fetch meditations** — single query: `WHERE category_id = ANY(categoryIds) AND is_active = true ORDER BY category_id, display_order ASC`; group into `Map<category_id, string[]>`.
6. **Build Email #1 HTML** — confirmation template.
7. **Send Email #1** — `POST https://api.resend.com/emails`; capture `resend_message_id`.
8. **Log Email #1** — `INSERT INTO email_logs` with `email_type = 'confirmation'`.
9. **Build Email #2 HTML** — prayer summary template with all meditations grouped by category.
10. **Send Email #2** — second Resend POST; capture `resend_message_id`.
11. **Log Email #2** — `INSERT INTO email_logs` with `email_type = 'summary'`.
12. **Return** `{ sent, failed }` counts.

### Error handling matrix

| Failure scenario | Behaviour |
|---|---|
| `commitment_id` missing or not UUID | Return `400`; send no emails |
| Commitment not found in DB | Return `404`; send no emails |
| DB unreachable / env secret missing | Return `500`; send no emails; log to Supabase function logs |
| Resend fails on Email #1 | Log `failed` row; proceed to attempt Email #2 |
| Resend fails on Email #2 | Log `failed` row; return partial result with `failed: 1` |
| Both Resend calls fail | Log two `failed` rows; return `{ sent: 0, failed: 2 }` |
| Frontend receives non-200 | Log error to console; do not surface blocking UI error to user |

### CORS headers

```typescript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};
```

---

## Frontend Changes

### Call site: `CommitmentForm.tsx`

After `prayerRepo.create()` resolves and returns the new `Prayer` entity:

```typescript
// Fire-and-forget — do not await before closing modal
supabase.functions.invoke('send-confirmation', {
  body: { commitment_id: newPrayer.id },
}).catch((err) => console.error('[send-confirmation]', err))
```

- The `onSuccess` callback (modal close + navigate to `/`) must **not** be gated on this call.
- A failed Edge Function call must **not** prevent the user from seeing the success state.
- The `supabase` instance used must be the same one already imported in the component (anon key).

### No new pages required

Both emails are delivered to the inbox. No in-app confirmation screen changes are required.

---

## Email Templates

Both templates follow the visual language established in `send-reminders`: `font-family: Georgia/serif`, `max-width: 560px`, earth-tone header (`#9a3412`), stone/cream body.

### Email #1 — Confirmation

| Field | Value |
|---|---|
| Subject | `Your prayer stone has been placed` |
| `from` | `Prayer Wall <{FROM_EMAIL}>` |
| Resend tag | `type: confirmation` |
| Tone | Short, warm, affirming |

**Body outline:**

```
[Header — #9a3412 banner]
  Prayer Wall · Commitment Confirmed

Hi {name},

Your name has been placed on the prayer wall.

Thank you for committing to intercede. Your stone has been added
to the wall and you will begin receiving prayer reminders on the
schedule set by your community.

[Footer — muted]
You're receiving this because you placed your name on the prayer wall.
Unsubscribe: {APP_URL}/unsubscribe?id={commitment_id}
```

### Email #2 — Prayer & Meditation Summary

| Field | Value |
|---|---|
| Subject | `Your prayers & meditations` |
| `from` | `Prayer Wall <{FROM_EMAIL}>` |
| Resend tag | `type: summary` |
| Tone | Devotional, structured |

**Body outline:**

```
[Header — #9a3412 banner]
  Prayer Wall · Your Prayers & Meditations

Hi {name},

Here are the prayers and meditations for the categories you selected.
Use these as a guide during your time of intercession.

━━━━━━━━━━━━━━━━━━━━━━

[Category 1 Name — bold, #9a3412]

{meditation body text paragraph}

{meditation body text paragraph}

━━━━━━━━━━━━━━━━━━━━━━

[Category 2 Name — bold, #9a3412]

{meditation body text paragraph}

━━━━━━━━━━━━━━━━━━━━━━

[Footer]
```

**HTML rendering rules:**

- Each category renders as a `<div>` with a `<p>` heading styled `font-weight: bold; color: #9a3412; text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px`.
- Each meditation `body` renders as a `<p>` with `margin: 0 0 1.2em; font-size: 15px; color: #44403c; line-height: 1.7` — this produces the paragraph-break separation.
- Categories are separated by `<hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0">`.
- If a category has no active meditations, its entire section is omitted.
- If **all** categories have no active meditations, a single paragraph is rendered: *"No meditations are currently available for your selected categories. Your community administrator will add content soon."*
- The unsubscribe link in the footer uses `{APP_URL}/unsubscribe?id={commitment_id}`, consistent with `send-reminders`.

---

## ADR-001 — Direct Supabase invocation instead of repository abstraction

**Date:** 2026-07-17  
**Status:** Accepted  

### Context

The existing codebase follows Clean Architecture throughout the commitment submission path. The `SubmitPrayerCommitment` use-case depends on `IPrayerRepository` and `IPrayerCategoryRepository` abstractions; Supabase is only referenced in `src/infrastructure/`. Nothing in the application or domain layers imports from `@supabase/supabase-js` directly.

A strictly consistent implementation of the `send-confirmation` invocation would introduce:

- `IEmailNotificationService` interface in `src/domain/services/`
- `SendConfirmationEmail` use-case in `src/application/use-cases/`
- `SupabaseEmailNotificationService` implementation in `src/infrastructure/`

### Decision

The `send-confirmation` Edge Function will be invoked **directly** from `CommitmentForm.tsx` using the existing `supabase` client instance, without an intermediate interface or use-case:

```typescript
supabase.functions.invoke('send-confirmation', {
  body: { commitment_id: newPrayer.id },
}).catch((err) => console.error('[send-confirmation]', err))
```

### Rationale

This is a small, single-deployment, single-tenant application with no anticipated need to swap infrastructure providers or scale significantly. The cost-benefit of the abstraction does not justify the overhead here:

- The app is tethered to Supabase by design across the entire stack — PostgREST, Edge Functions, Realtime, RLS, pg_cron. There is no realistic scenario where `supabase.functions.invoke()` is replaced with a different call.
- The invocation is fire-and-forget with no domain logic — it is a side-effect notification, not a business rule. Use-cases are appropriate when they enforce invariants or coordinate multiple repositories; this does neither.
- Adding the abstraction layer would triple the number of files touched for a one-line call site change, increasing cognitive overhead for a developer maintaining a small codebase alone.

### Consequences

- **Accepted:** `CommitmentForm.tsx` takes a direct dependency on the Supabase client for this call.
- **Accepted:** The `send-confirmation` Edge Function itself has no clean architecture structure — it is a self-contained Deno script, consistent with `send-reminders`.
- **Mitigated:** If the notification mechanism ever needs to change (e.g. send a push notification instead), the change is isolated to `CommitmentForm.tsx` — a single, small component. The blast radius of breaking the abstraction rule is minimal.
- **Not applicable:** Unit testing the confirmation trigger in isolation is not a current requirement. If it becomes one, an `IEmailNotificationService` interface can be introduced at that point without breaking existing functionality.

---

## Implementation Checklist

- [ ] **Migration** — Create and apply `supabase/migrations/018_email_logs_type.sql`
- [ ] **Edge Function** — Create `supabase/functions/send-confirmation/index.ts`
- [ ] **Deploy** — `supabase functions deploy send-confirmation`
- [ ] **Frontend** — Add fire-and-forget `supabase.functions.invoke('send-confirmation', ...)` in `CommitmentForm.tsx` after successful commitment creation
- [ ] **Verify secrets** — Confirm `RESEND_API_KEY`, `FROM_EMAIL`, `APP_URL` are set in Supabase Dashboard → Edge Functions → Secrets
- [ ] **Verify Resend domain** — Confirm sender domain is verified in the Resend dashboard with SPF, DKIM, and bounce MX records
- [ ] **Test E2E** — Submit a commitment on the live app; verify both emails arrive, two rows appear in `prayer_wall.email_logs` with correct `email_type` values
- [ ] **Monitor** — Check Supabase Edge Function logs (Dashboard → Edge Functions → Logs) and `prayer_wall.email_logs` for any `failed` status rows after first real-world use

---

## Future Enhancements

- **Idempotency guard** — Before sending, check `email_logs` for an existing `confirmation` row for this `commitment_id`; skip if found. Prevents duplicate emails on frontend retry.
- **Resend bounce webhook** — Configure a Resend webhook URL pointing to a new `handle-bounce` Edge Function that sets `reminder_active = false` on hard bounce, consistent with what `send-reminders` recommends.
- **Admin test send** — Admin panel button that triggers a preview confirmation + summary pair to the admin's own email for a selected commitment, without creating new log rows.
- **Customisable copy** — Store `confirmation_subject`, `confirmation_intro`, `summary_subject`, `summary_intro` per wall in `wall_theme` so each organisation can personalise template copy without a code deployment.
- **Delay between emails** — If Resend's threading causes the summary to appear inside the confirmation thread (reducing its perceived importance), introduce a deliberate 3–5 second `setTimeout` between the two Resend calls.
- **Per-person category summary** — Future admin UI to let users update their category selection post-commitment; re-sending the summary email after a category change would use the same `send-confirmation` function with an `updateCategories: true` flag.
