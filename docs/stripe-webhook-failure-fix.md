# Fix: Stripe Webhook Failures (`giving-wall-webhook`)

Written in plain words. Last checked against the code on 2026-11-01.

## The short version

- Stripe says 17 live deliveries to our webhook URL have failed since **Oct 29, 2026, 14:58 UTC**.
- If it is not fixed, Stripe turns the endpoint off on **Nov 7, 2026, 14:58 UTC**.
- The failures began one second before the **first monthly gift** was made.
- A monthly gift makes Stripe send many events at once (`invoice.created`, `invoice.paid`, `customer.subscription.created`, and others).

## What the Stripe email tells us

- It says **"17 requests had other errors."** It gives no status code, so it does not tell us if the reply was 401, 400, or 500. Only the failed deliveries in the Dashboard show that.
- "17 attempts" is **attempts, not events**. Stripe retries a failed live event many times over about 3 days. So this is probably **only one or two events**, tried again and again. That fits one extra destination, not many broken event types.
- The email confirms the risk to us: new subscription invoices can be **delayed up to 3 days** while the endpoint keeps failing.
- It also says to **review completed payments**. Do the check in Step 6 (compare Stripe Payments with the wall).
- Use the Stripe **account ID `acct_1U1CDOR1ITVEM2IX`** and the email ID `em_oskwql1hcf1fwh1bao3ghxfawhzjo4` if you contact Stripe support.

## What the Stripe delivery log shows

This is the "Prayer Wall live" destination, which you pasted from the Dashboard.

- **Our function is working for this destination.** Every `checkout.session.completed` since Oct 20 got **200**. The two 401s on Oct 20 are the old JWT problem, already fixed.
- **The first monthly gift was saved correctly.** The Oct 29, 10:58:48 AM event got 200 with a `donation_id` and `commitment_id`.
- **This destination is not the broken one.** See the update below: the failing delivery was found, and it is a second endpoint.

Useful facts from the event, for the code work in Step 3:

| Field | Value for a monthly gift |
|---|---|
| `mode` | `subscription` |
| `payment_intent` | `null` (so our code saves the donation under the **session ID**, `cs_live_...`) |
| `subscription` | `sub_...` (we do **not** save this yet) |
| `invoice` | `in_...` (the first month's invoice) |

Because the first month is saved under the session ID, a later `invoice.paid` for the first invoice would **not** match it and would count twice. So skipping `billing_reason = subscription_create` is required, not optional.

## Update: the failing delivery was found (Nov 1)

Opening the event `evt_1UVumxR1ITVEM2IXLbdux1Km` in Stripe (Workbench → Events) shows:

- The failing event is **`checkout.session.completed`**, the same event that already got **200** from "Prayer Wall live" at 10:58:48 AM.
- Under "Deliveries to webhook endpoints" there is a **401** to our URL, last tried **Nov 1, 6:45:47 AM**.
- So the same event is being sent to our URL by **two endpoints**. One works. The other gets **401**.
- **The earlier idea about `invoice.*` events was wrong.** The failures are not about subscription event types. The code is fine for those.

### Why 401, and why it is almost certainly the wrong signing secret

- The working endpoint proves the Supabase JWT check is already off. If JWT were on, it would fail too.
- Our function returns 401 only for "Invalid signature". Each Stripe endpoint has its own `whsec_...` secret, and our function only knows one (`STRIPE_WEBHOOK_SECRET`). The second endpoint signs with a different secret, so every delivery from it is rejected.
- Stripe retries the failing delivery again and again. That is the 17 attempts.

### Quick proof (2 minutes)

In Supabase → Edge Functions → `giving-wall-webhook` → Logs, look at **Nov 1, about 06:45 UTC**. If you see `giving-wall-webhook: invalid signature`, this is confirmed. (If the logs show nothing, the 401 came from the Supabase gateway instead, which would mean a JWT problem. That is unlikely.)

### The fix (no code change is needed to stop the failures)

1. In Stripe, find the **second endpoint** that points at the giving-wall-webhook URL. Check **Developers → Webhooks** (old-style endpoints) and the full **Event destinations** list.
2. Open it and check which events it sends and which signing secret it has. Do **not** delete "Prayer Wall live". That one works.
3. **Delete or disable the extra endpoint.** It is a duplicate. Our function already records each gift once, and a duplicate delivery cannot create a second donation.
4. In Stripe, **Resend** or let the pending retries finish. Once the bad endpoint is gone, the failures stop.

Only if the second endpoint is needed (for example, it belongs to another tool), add its secret to `STRIPE_WEBHOOK_SECRETS` and use the multi-secret code change in Step 3.

### Found it (Nov 1)

The Event destinations list has two entries for our URL:

| Destination | Events | Error rate |
|---|---|---|
| Prayer Wall live | 1 event | 0 % |
| (unnamed, imported) | 2 events | **100 %** |

The unnamed one is the extra endpoint. To remove it safely:

1. Open it and **write down which 2 events** it listens to.
2. Check "Prayer Wall live" covers them. Our code acts on `checkout.session.completed` **and** `checkout.session.async_payment_succeeded`. Donors can pay with Klarna and Cash App, which can finish later. If the unnamed endpoint had `async_payment_succeeded` and "Prayer Wall live" does not, **add it to "Prayer Wall live"** first, or those gifts will be missed.
3. **Disable** the unnamed endpoint first. Watch for a day. Then **delete** it.

### The delivery history backs this up

The history for one event (the Oct 28, 8:23 PM gift) reads like this:

- First try: **200 OK, Delivered** (this is "Prayer Wall live").
- Then **401 Unauthorized, "Retried automatically"** at 8:23:54 PM, 9:23:57 PM, Oct 29 1:24 AM, Oct 29 3:34 PM, Oct 30 3:10 PM, and Oct 31 3:27 PM.

Stripe only retries a delivery that failed. The same event was already delivered with 200, so the retries must come from a **second endpoint** whose first attempt also got 401. Stripe's retries for a live event run about 3 days, then stop.

What this means:

- **The failures started with the Oct 28, 8:23 PM gift** (the first monthly gift), not Oct 29. The Oct 29 date in the email is just the start of the window it summarized.
- **No payment data is lost.** Every failing event was already saved through the working endpoint. There is **nothing to resend**. Just remove the duplicate endpoint so the retries and the warning emails stop.
- **The Nov 7 shut-off date is only a risk for the bad endpoint.** "Prayer Wall live" is healthy. Still, remove the bad one before Nov 7, so Stripe does not also mark the URL as unreliable.

### Other things seen in the events

- Three monthly (`mode: subscription`) gifts have come in on Oct 28–29, and all three were saved on "Prayer Wall live". The first renewals fall around **Nov 28–29**, so the `invoice.paid` work in Step 3 should be done before then.
- Two of those monthly gifts have the **same donor email**, about 20 minutes apart (Oct 29, 10:38 AM and 10:58 AM), with **different Stripe customers**. This may be a donor who tried twice. Check in Stripe → Billing → Subscriptions that the donor is not being billed **twice** every month. If so, cancel one and refund as the school decides.

## What the code does today

I read `supabase/functions/giving-wall-webhook/index.ts`. The earlier write-up guessed the code crashes on events it does not know. **The code already handles that.**

| Question | Answer in current code |
|---|---|
| Unknown event type (like `invoice.created`)? | Saved to the audit table, then returns **200**. It does not crash. |
| Bad signature? | Returns **401**. |
| Event is from the wrong mode (test vs live)? | Returns **400**. |
| Database fails? | Returns **500** so Stripe tries again. |
| Same event sent twice? | Safe. The donation is only created once. |
| `invoice.paid` for monthly gifts? | **Not handled.** It is skipped. |

So the "it crashes on new event types" idea is probably **not** the real cause. The most likely causes are these, from most to least likely:

1. **A second Stripe destination with its own signing secret.** Each destination has its own `whsec_...` secret. Our function only knows one (`STRIPE_WEBHOOK_SECRET`). Any event from the other destination fails the signature check and gets a **401**. This also fits the clue that the "Prayer Wall live" page only shows successful `checkout.session.completed` events: the failing events come from somewhere else.
2. **The deployed function is older than the code in the repo.** Then the "skip unknown events" fix may not be live.
3. **The audit-table insert fails** and returns 500. This is less likely, because the table has no tight limits.

We cannot know which one without looking at the failed deliveries. **Step 1 below decides everything.**

## Step 1: Find the real cause (Terry, in Stripe and Supabase)

1. Stripe Dashboard → Developers → **Event destinations**. List every destination. Look for any other destination, or an old "Webhook endpoint", that points to the same Supabase URL.
2. Open that destination and filter deliveries by **Failed**. Write down:
   - the event types (for example `invoice.created`)
   - the response (**401**, **400**, **500**, "timed out", or "connection error")
3. Supabase Dashboard → Edge Functions → `giving-wall-webhook` → **Logs**. Look near 2026-10-29 14:58 UTC. Search for:
   - `invalid signature` → cause 1 (wrong secret)
   - `does not match STRIPE_MODE` → mode problem
   - `Failed to write webhook_events row` → cause 3
   - nothing at all → the request never reached the function (check JWT setting and cause 2)

## Step 2: Fix it based on what you found

### If the response was 401 (wrong signing secret)

This is the most likely case.

- **Best fix:** delete or disable the extra destination. Keep only one live destination for this URL.
- **Other fix:** if you must keep two, support both secrets. Add a secret called `STRIPE_WEBHOOK_SECRETS` (comma separated) and try each one until one matches. Keep `STRIPE_WEBHOOK_SECRET` working too.

### If the response was 400 (mode mismatch)

Check the Supabase secret `STRIPE_MODE`. It must be exactly `live` in production. If it is missing, the code assumes `test` and rejects every live event.

### If the response was 500 or a timeout

Read the log line next to it. Fix that error. Then redeploy.

### If nothing is in the logs

Redeploy the function from the repo with JWT check off (see Step 4).

## Step 3: Code changes (needed for monthly gifts)

Even if the failures are fixed in Step 2, **monthly gifts after the first one will not show on the wall**, because `invoice.paid` is ignored. Add this:

1. **Handle `invoice.paid`.**
   - If `invoice.billing_reason === "subscription_create"`, **skip it**. The first month is already saved by `checkout.session.completed`. Saving it again would count it twice.
   - If `billing_reason === "subscription_cycle"`, this is a renewal. Find the original commitment by subscription ID and add a donation for `invoice.amount_paid`.
   - On API version `2026-07-29.dahlia`, the subscription ID is at `invoice.parent.subscription_details.subscription`. **Check a real event in the Stripe log to confirm** before relying on it.
2. **Save the subscription ID** when handling `checkout.session.completed` for monthly gifts (`session.mode === "subscription"`, field `session.subscription`). Without it, renewals cannot be matched to the donor. Add the column in a new migration, and **update `types.ts`** in the same change (project rule).
3. **Use a stable key for renewals.** Use the invoice ID as the `processorRef` so a repeated event cannot create a second donation. The existing `record_paid_donation` function already ignores repeats of the same reference. Check that it can take an existing commitment for renewals, or add a small new function for that.
4. **Optional:** on `customer.subscription.deleted`, mark the commitment inactive.
5. **Keep responses fast.** Do the database write, then return. Keep the thank-you email in `EdgeRuntime.waitUntil(...)` (already done).
6. **Keep the safe rules:** a good signature plus an unknown event gives **200**. A bad signature gives **4xx**. A temporary database error gives **500**. A bad-data error that can never work gives **200** with a logged note, so Stripe does not retry forever.

### Small clean-up worth doing

- The current code returns **401** for a bad signature. Stripe's own advice is **400**. Either works for blocking forged requests, but use **400** to match Stripe's docs.
- The code checks the signature by hand. That works. Switching to `stripe.webhooks.constructEventAsync` is optional and not the cause of this problem.

## Step 4: Deploy

Stripe cannot send a Supabase login token, so the JWT check **must stay off**.

```bash
supabase functions deploy giving-wall-webhook --no-verify-jwt
```

Note: there is **no `supabase/config.toml` in this repo**. To keep the setting from turning back on, create one with:

```toml
[functions.giving-wall-webhook]
verify_jwt = false
```

(The Oct 20 errors were this exact problem. Do not let a redeploy turn it back on.)

## Step 5: Clean up Stripe

Keep **one** live destination for this URL. Subscribe it only to events the code handles:

- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.deleted` (only if you build it)

Why this matters: if a destination listens to `invoice.created` and keeps failing, Stripe waits up to 3 days before finalizing each new monthly invoice. The Oct 29 donor's next charge is around **Nov 29**.

## Step 6: After you deploy

1. If the failures turned out to be real misses (not duplicates), open each failed delivery and click **Resend**, and confirm each gets **200**. For the current case you can skip this: the events were already saved by "Prayer Wall live".
2. Compare Stripe Payments since Oct 29, 2026 with the donations on the giving wall. Fix any gaps by hand.
3. In **test mode**, run `stripe trigger invoice.paid` and `stripe trigger customer.subscription.created`. Confirm **200** replies and **no duplicate donations**.
4. Run the existing tests: `node --test supabase/functions/stripe-mode.test.mjs`. Add tests for `invoice.paid` (first month skipped, renewal saved, repeat ignored).
5. Watch Stripe for 24 hours. There should be no new failures.

## Done when

- [ ] The real cause is found and written down (Step 1).
- [ ] Only one live destination points to the URL, or both secrets are supported.
- [ ] Every verified event gets a 2xx unless we truly want a retry.
- [ ] Unknown event types get 200.
- [ ] Monthly renewals create a donation. The first month is not counted twice.
- [ ] Repeated events do not create duplicates.
- [ ] `verify_jwt = false` is committed in `supabase/config.toml`.
- [ ] All failed deliveries since Oct 29 were resent and got 200.
- [ ] No new failures for 24 hours after deploy.
- [ ] Done before **Nov 7, 2026**.
