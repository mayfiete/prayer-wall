# Security remediation checklist

This checklist turns the known gaps in [Security posture and remaining work](../README.md#security-posture-and-remaining-work) into trackable tasks. Items are **not verified complete**. Work against a disposable local Supabase stack first; repository migrations are applied manually to the target project. Do not treat code review alone as proof of deployed permissions.

## Admin authorization — high priority

- [ ] Define a trusted admin role or allowlist and enforce it in database RLS and Storage policies, not only in `AdminAuthGuard` or `VITE_ADMIN_EMAIL`.
- [ ] Audit grants and policies for every admin-managed table, including `prayer_wall.email_copy`, and remove administration rights from ordinary authenticated users.
- [ ] Restrict access to `prayer_wall.webhook_events`, including raw Stripe payloads, to authorized server/admin roles.
- [ ] Verify unauthorized authenticated users cannot read or change protected records or assets, while authorized admins retain required access.
- [ ] Until server-side authorization is enforced, restrict account creation and admin access operationally.

## Email function authorization — high priority

- [ ] Require an explicitly authorized webhook/service-role caller for `send-donation-thanks`; a valid JWT or anon token alone is insufficient.
- [ ] Protect `send-confirmation` against arbitrary resends for existing commitments while preserving the intended public signup flow.
- [ ] Add appropriate resend/rate limits and abuse controls; test both denied calls and legitimate email requests with mocked delivery.
- [ ] Redeploy changed Edge Functions after testing; frontend deployment alone does not update them.

## Donation opt-out

- [ ] Make `send-donation-thanks` honor `email_opt_out` before sending even when `thank_you_sent` is false.
- [ ] Add regression coverage for an opted-out, unsent donation and for a permitted first-time thank-you.

## Public data and retention

- [ ] Decide whether `donations.processor_ref` and `donations.email_opt_out` should be accessible through the public API.
- [ ] If not, add a **new sequential corrective migration** that removes broad SELECT grants before granting only approved columns; update browser projections and API/Realtime privacy tests.
- [ ] Restrict access to raw webhook audit payloads and define a retention/deletion policy for donor data and event records.
- [ ] Verify public queries and Realtime subscriptions expose only intended fields, including on existing and new subscriptions.

## Deployment and operational verification

- [ ] Inspect effective `anon`, `authenticated`, and `service_role` grants, RLS and Storage policies on the actual target project; do not infer them from migration filenames.
- [ ] Verify Edge Function JWT settings, caller authorization, function logs, and project-side abuse/rate-limit controls.
- [ ] Confirm service-role, Stripe, and Resend secrets remain server-side; public `VITE_*` values contain no secrets.
- [ ] Confirm public production builds cannot use mock checkout; keep test and live projects and credentials separate.
- [ ] Run relevant regression tests against disposable environments, including `node --test supabase/functions/donation-access.test.mjs` with its required local-stack variables; check both forbidden and permitted behavior.
- [ ] After applying any schema changes manually, run `NOTIFY pgrst, 'reload schema';` and verify the deployed behavior again.
- [ ] Assess payment and data-handling obligations separately; Stripe-hosted Checkout alone does not establish PCI compliance.
