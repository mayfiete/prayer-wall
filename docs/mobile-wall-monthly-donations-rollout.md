# Mobile walls and monthly donations rollout

## Changes

- Wall containers narrower than 640px use repeating offset rows of two and three tiles, including the join tile. Desktop layout continues to use the configured theme.
- The prayer guide lists all selected categories, including categories without active prayer requests. Request sections still show only available requests.
- Live prayer additions and mock prayer lists put the newest stones first; production reads already sort newest first.
- Giving checkout requires an unchecked monthly donation agreement. Changing the amount clears consent. The application and checkout edge function both validate consent.
- New Stripe Checkout Sessions use subscription mode with a monthly recurring price. The session records consent, its timestamp, and the agreed monthly amount in metadata. Stripe manages recurring collection.
- The initial paid checkout creates one donation/brick and one thank-you email. Renewals do not create extra bricks or update the wall's donation total; renewal history, failed payments, and cancellation are managed in Stripe. Existing one-time payments remain unchanged.

Stripe reference: https://docs.stripe.com/api/checkout/sessions/create

## Deploy

No database migration or new secret is required for this change.

1. Coordinate the frontend and checkout edge-function release. Deploy the checkout function first, then the frontend immediately afterward: the old frontend will be blocked until refreshed because it does not send consent. Do not deploy the monthly-labeled frontend against the old one-time checkout function.
2. Redeploy `create-donation-checkout` and `send-confirmation`:

   ```sh
   supabase functions deploy create-donation-checkout
   supabase functions deploy send-confirmation
   ```

3. Publish the frontend build using the existing deployment process.
4. The webhook and shared email layout have not changed and do not need redeployment for this release.
5. Keep the existing explicit test/live mode setup and webhook signature verification. Test with a separate test wall/project and controlled recipient addresses; Stripe test checkouts still trigger real thank-you emails.

## Verify after deployment

- At phone widths (320px, 390px, 430px), both walls show 2/3/2/3 rows without horizontal scrolling. Check long names and the join tile. Desktop should retain its theme layout.
- Add a prayer while another window watches the wall. The stone should appear at the top, and remain at the top after refresh.
- Select three or four prayer categories, including one without active prayer requests. All selected names should appear in the prayer-guide email. Also check a selection where none has active requests.
- Checkout starts with consent unchecked. It cannot continue without consent. Selecting another preset or editing a custom amount clears consent and updates the agreement's amount.
- Complete a Stripe test checkout and verify Stripe shows a monthly subscription for the agreed amount, one wall brick, and one initial thank-you. Retry webhook delivery and verify no duplicate brick.
- Use Stripe's subscription management for cancellation and renewal history; this release does not add a donor billing portal or convert existing gifts to subscriptions.

## Local checks

```sh
node --test tests/*.test.mjs supabase/functions/*.test.mjs
npm run build
npm run lint
```

Database/API integration tests require the disposable test environments described in AGENTS.md and skip when those environments are absent. Unit tests mock Stripe, Supabase, and email calls; they make no charges or send emails.
