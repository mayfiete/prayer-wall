# Giving Wall — Stripe Test Mode Setup

How to get from the simulated checkout (mock mode) to real test transactions with
Stripe test cards. Nothing here touches live money — every step stays in Stripe's
test mode until you deliberately switch.

**Related:** `docs/decisions/004-giving-wall-architecture.md` (and its amendment
at the bottom of that file), `supabase/migrations/026_giving_wall_stripe.sql`

---

## How the flow works

```
Browser (amount + optional Full Name + anonymous choice)
│  StripeCheckoutGateway → create-donation-checkout edge function
│
Stripe-hosted Checkout page  ← donor enters name, address, email, card here
│  Fields collected: billing name/address, email, card
│  Full Name from our form travels in Checkout Session metadata
│
Stripe fires checkout.session.completed
│
giving-wall-webhook edge function
│  verify HMAC + mode + wall → audit to webhook_events
│  → record_paid_donation (donation + commitment, one transaction) → invoke thank-you
│
Supabase Realtime → brick animates onto the wall
```

Card data never reaches our code, which keeps the project in PCI **SAQ A** scope.
The browser cannot create a donation: RLS restricts `INSERT` on
`prayer_wall.donations` to `service_role`.

---

## Step 0 — Run the migration

In Supabase → SQL Editor, run `supabase/migrations/026_giving_wall_stripe.sql`.
It adds `webhook_events`, `donations.thank_you_sent`, the `email_logs` columns for
giving-wall emails, and publishes `donations` to Realtime.

Then run the diagnostic at the bottom of that file with your
`VITE_GIVING_WALL_ID`. You need **at least one `true`**, and the value of
`fk_points_at` tells you which table the id must exist in:

| `fk_points_at` | What must be true |
|---|---|
| `prayer_wall.walls` | your `VITE_GIVING_WALL_ID` must be a row in `walls` |
| `prayer_wall.giving_walls` | it must be a row in `giving_walls` |

If neither is true, insert the row before testing — otherwise the webhook will
fail with a foreign-key violation and you'll see `status = 'failed'` in
`webhook_events`.

For the current unified-walls deployment, ensure migration
`029_walls_app_type.sql` is applied, then run
`supabase/migrations/030_donation_commitments.sql`, followed by
`supabase/migrations/031_donation_full_name.sql`, then
`supabase/migrations/032_restore_commitment_public_reads.sql` **before deploying the updated
webhook**. Do not run migration 027 on this project: its giving wall already lives
in `prayer_wall.walls`, not a separate `giving_walls` table.

Migration 030 adds `commitments.first_name`, `commitments.last_name`, and
`donations.commitment_id`, plus the service-role-only `record_paid_donation` RPC.
Confirm that `GIVING_WALL_ID` and `VITE_GIVING_WALL_ID` identify the same row in
`prayer_wall.walls` with `app_type = 'giving'`.

Each paid donation gets one linked commitment on that wall, with
`reminder_active = false` (donating does not subscribe someone to prayer emails).
Migration 031 adds `commitments.full_name` and backfills linked commitments from
their donation's existing display name. The donation form collects one optional
**Full Name** before opening Stripe. The gateway sends `full_name` to the checkout
function, which stores it in Checkout Session metadata; new sessions have no
custom name fields. The webhook uses that full name when provided, otherwise
legacy session custom fields, otherwise Stripe's billing name,
otherwise "Anonymous". Choosing anonymity always wins. The resolved name is saved
in both `commitments.full_name` and the existing public `name` columns; the paid
amount, currency, and Stripe payment reference stay in `donations`.

The webhook no longer splits billing names or sends separate first/last names.
Existing first/last columns and data remain intact, and older Checkout Sessions
with those fields can still settle. The RPC retains optional legacy name arguments
so the currently deployed webhook works while the new functions are rolled out.
Migration 031 can be rerun without overwriting populated full names. Ordinary prayer
signups continue using their single `name` field. Missing legacy email is stored
as an empty commitment email. Unauthenticated clients continue reading the public
`name` column rather than the private commitment fields.

Migration 032 repairs public commitment reads on projects that ran the original
031. It restores only the six public columns used by the prayer wall, keeping
email and the separate name fields private. It is safe to rerun and requires no
edge-function redeployment.

For the pre-checkout Full Name form change, no additional migration is needed.
Deploy `giving-wall-webhook` first (with `--no-verify-jwt`), then
`create-donation-checkout`, then release the frontend. The webhook accepts both
new Full Name metadata and the older custom fields during rollout.

Finally: `NOTIFY pgrst, 'reload schema';`

---

## Step 1 — Get your Stripe test keys

1. Create/sign in at <https://dashboard.stripe.com>.
2. Confirm the **Test mode** toggle (top right) is ON. Test keys are prefixed
   `sk_test_` / `pk_test_` — if you ever see `sk_live_`, stop.
3. Go to **Developers → API keys**.
4. Copy the **Secret key** (`sk_test_…`). Reveal it once and store it in your
   password manager; Stripe won't show it again.

You do **not** need the publishable key: no Stripe JS ships in the browser with
hosted Checkout.

You also don't need to activate the account or add a bank account to use test
mode — activation is only required before accepting live payments.

---

## Step 2 — Set the Supabase secrets

Supabase Dashboard → **Edge Functions → Secrets** (or the CLI below):

| Secret | Value | Used by |
|---|---|---|
| `STRIPE_MODE` | `test` (default when unset; only `test` or `live` accepted) | both |
| `STRIPE_SECRET_KEY` | `sk_test_…` | create-donation-checkout |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (Step 4) | giving-wall-webhook |
| `GIVING_WALL_ID` | same UUID as `VITE_GIVING_WALL_ID` | both |
| `APP_URL` | e.g. `https://giving.prayerrhythm.com` | checkout return URLs, email links |
| `ORG_NAME` | `Heritage Christian Academy` | Checkout line-item name |
| `RESEND_API_KEY`, `FROM_EMAIL` | already set for the prayer wall | send-donation-thanks |

```bash
supabase secrets set STRIPE_MODE=test STRIPE_SECRET_KEY=sk_test_xxx GIVING_WALL_ID=<uuid> ORG_NAME="Heritage Christian Academy"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — never
set them by hand.

Checkout rejects a key whose prefix does not match `STRIPE_MODE` before calling
Stripe, and verifies the returned session's `livemode` before returning its URL.
The webhook verifies the signature, then rejects events (and actionable sessions)
whose `livemode` does not match the deployment before any database writes or emails.
A `whsec_…` prefix does not indicate test vs. live: use the signing secret from the
matching test endpoint. These guards take effect only after deploying both functions.

**Use a dedicated test Supabase project/wall and an email address you control.**
Stripe test mode prevents real charges, but successful test payments still create
normal donation rows, affect wall totals, and trigger real thank-you emails.
There is no test/live flag on donation rows. `STRIPE_MODE` is deployment-wide,
not a browser toggle or a way to run test and live payments simultaneously.

---

## Step 3 — Deploy the functions

```bash
supabase functions deploy create-donation-checkout
supabase functions deploy send-donation-thanks
supabase functions deploy unsubscribe            # updated for donation opt-out
supabase functions deploy giving-wall-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook is required and safe: Stripe can't present a
Supabase JWT, so the function authenticates every request by verifying the
`Stripe-Signature` HMAC and rejects anything that fails with a 401.

---

## Step 4 — Register the webhook endpoint

1. Stripe Dashboard (still in test mode) → **Developers → Webhooks → Add endpoint**.
2. URL: `https://<project-ref>.supabase.co/functions/v1/giving-wall-webhook`
3. Events to send:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
4. Save, then click **Reveal** under *Signing secret* and copy the `whsec_…`.
5. `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx`

Secrets are read at cold start, so redeploy the webhook after setting it:
`supabase functions deploy giving-wall-webhook --no-verify-jwt`

---

## Step 5 — Test end to end

Set `VITE_USE_MOCK=false` and `VITE_GIVING_WALL_ID=<uuid>` in `.env.local`, run
`npm run dev`, and open `/giving`.

1. Click the open brick, pick an amount, optionally enter **Full Name**, and press
   **Continue to secure checkout**. Choose Anonymous to hide the name on the wall.
2. On Stripe's page fill in billing details, email, and the card below.
3. Stripe redirects back to `/giving?checkout=success`.
4. The brick appears via Realtime within a second or two.

### Test cards

| Number | Result |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication, then succeeds |
| `4000 0000 0000 0002` | Declined (generic) |
| `4000 0000 0000 9995` | Declined — insufficient funds |
| `4000 0000 0000 0069` | Declined — expired card |
| `4000 0000 0000 0127` | Declined — incorrect CVC |

Any future expiry date, any 3-digit CVC, any ZIP. Full list:
<https://docs.stripe.com/testing>

These are the same numbers the mock card form accepts, so behaviour is identical
either side of the switch.

### Testing the webhook locally

The deployed webhook works with a local frontend, since Stripe calls Supabase
rather than your machine. To iterate on webhook code itself:

```bash
supabase functions serve giving-wall-webhook --no-verify-jwt --env-file ./supabase/.env.local
stripe listen --forward-to http://localhost:54321/functions/v1/giving-wall-webhook
# stripe listen prints its own whsec_… — use THAT value in the local env file
stripe trigger checkout.session.completed
```

Note that `stripe trigger` generates a synthetic session with no
`custom_fields`/`metadata`, so the brick falls back to the billing name or
`Anonymous`. Use a real test purchase to exercise the naming logic.

---

## Step 6 — Verify

```sql
-- Every event Stripe sent, newest first
select event_type, status, error_message, donation_id, received_at
  from prayer_wall.webhook_events
 order by received_at desc limit 20;

-- The bricks that resulted
select name, amount_cents, currency, processor_ref, thank_you_sent, donated_at
  from prayer_wall.donations
 order by donated_at desc limit 20;

-- Thank-you emails
select email, status, email_type, sent_at
  from prayer_wall.email_logs
 where email_type = 'donation_thank_you'
 order by sent_at desc limit 20;
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Payments are not configured yet" | `STRIPE_SECRET_KEY` or `GIVING_WALL_ID` missing | set secrets, redeploy |
| Stripe shows the event as 401 | `STRIPE_WEBHOOK_SECRET` doesn't match this endpoint | copy the signing secret for *this* endpoint; redeploy |
| `webhook_events.status = 'failed'`, FK violation | wall id missing from the table the FK points at | see Step 0 diagnostic |
| Event 200 but no brick appears | `donations` not in the Realtime publication | rerun migration 026 section 4 |
| `permission denied for table donations` | table-level grant missing | rerun migration 024 |
| Brick says "Anonymous" unexpectedly | no wall-name custom field and no billing name | check `billing_address_collection=required` is still set |
| Duplicate bricks | shouldn't happen — `processor_ref` is UNIQUE and events are deduped by `processor_event_id` | inspect `webhook_events` for two different payment intents |
| Thank-you email 403 from Resend | `FROM_EMAIL` domain not verified | verify `prayerrhythm.com` in Resend |

---

## Going live (later)

1. Activate the Stripe account (business details + bank account).
2. Set `STRIPE_MODE=live` explicitly and swap `STRIPE_SECRET_KEY` to `sk_live_…`.
   A live key alone is intentionally blocked by the default test-mode guard.
3. Create a **separate** live-mode webhook endpoint; its signing secret differs —
   update `STRIPE_WEBHOOK_SECRET`.
4. Confirm `GIVING_WALL_ID` points to the intended live wall, not your test wall.
5. Redeploy both functions and make one small real gift as a smoke test.
