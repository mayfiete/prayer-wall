# AI Agent Rules — Prayer Wall

This file is read automatically by Windsurf (Cascade), Cursor, and other AI coding tools at the start of every session. Follow all rules below without exception.

---

## Git

- **Never run `git add`, `git commit`, or `git push`.**
- Make code changes only. The user handles all git operations.

---

## Naming Conventions

| Term | Use where |
|---|---|
| **Stonemasons** | Admin UI label for people on the prayer wall (tab, headings, copy) |
| **Stones / foundation** | Public-facing UI (wall page, commitment form, success messages) |
| **Bricklayers** | The *giving wall* product only — do NOT use for the prayer wall |

These were aligned in Jul 2026. Do not revert to "bricklayers" anywhere in the prayer wall.

---

## Schema & Types

- All tables are in the **`prayer_wall`** Postgres schema, not `public`.
- `src/infrastructure/supabase/types.ts` is **manually maintained** — it is NOT auto-generated.
- **Every migration that adds a table or column must also update `types.ts`**, or TypeScript queries will silently break.
- Every Supabase client (frontend or edge function) must be configured with `db: { schema: 'prayer_wall' }`.

---

## Repository Wiring (container.ts)

See `docs/decisions/003-mock-vs-supabase-repos.md` for full context.

When adding a new repository:
1. Create `src/infrastructure/mock/MockPrayerXxxRepository.ts`
2. Create `src/infrastructure/repositories/SupabasePrayerXxxRepository.ts`
3. Wire **both** in `src/infrastructure/container.ts` — mock in `if (USE_MOCK)`, Supabase in `else`
4. Add the table type to `types.ts`

**Never use a Mock repo in the `else` (production) branch of container.ts.**

---

## Migrations

- Migration files live in `supabase/migrations/` numbered sequentially (`001_`, `002_`, …).
- They are NOT auto-applied — the user must run them manually in the Supabase SQL Editor.
- After schema changes, remind the user to run `NOTIFY pgrst, 'reload schema';` to refresh PostgREST cache.
- Migration `019_grant_service_role_schema.sql` must be run or edge functions will fail with permission errors.

---

## Edge Functions

- Edge functions run on Deno. Deno lint errors in VS Code are false positives — ignore them.
- Every edge function creates its own Supabase client with `service_role` key and `db: { schema: 'prayer_wall' }`.
- The `send-reminders` function is triggered hourly by pg_cron. It must be redeployed after any code changes.
- The pg_cron job reads its URL and auth header from **Supabase Vault** (`project_url`, `cron_secret`), not from Postgres GUCs. Migration 012 used `current_setting('app.*')` and failed on every run; migration 028 replaced it. The Vault `cron_secret` and the `CRON_SECRET` edge secret must hold the same value.
- Secrets (RESEND_API_KEY, FROM_EMAIL, CRON_SECRET, APP_URL, SUPABASE_WALL_ID) are set in Supabase Dashboard → Edge Functions → Secrets.
- Bible verse lookup is **discontinued** (Sep 2026) — do not set `API_BIBLE_KEY` or `YOUVERSION_APP_KEY`. The `_shared/*bible*` and `prayer-search-*` code is dormant, not broken: `findPassageForText` catches all provider failures and returns `null`, so reminder emails simply send without a passage.

---

## Payments (Giving Wall)

- Payments use **Stripe-hosted Checkout**, not an embedded card form. No Stripe keys or Stripe JS belong in the frontend or `.env.local`.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GIVING_WALL_ID`, `ORG_NAME` are Supabase edge function secrets.
- Only `giving-wall-webhook` (service_role) may create `donations` rows — RLS blocks the browser. It listens to `checkout.session.completed`, never `payment_intent.succeeded`.
- Deploy the webhook with `--no-verify-jwt`; it authenticates via `Stripe-Signature` HMAC.
- Mock mode (`VITE_USE_MOCK=true`) uses `MockPaymentGateway`, which accepts Stripe's real test card numbers (`4242…` approves, `4000…0002` declines).
- Full setup and test procedure: `docs/giving-wall-stripe-test-mode.md`.
- `STRIPE_MODE` is a Supabase edge function secret, defaulting to `test`. Both payment functions reject invalid modes; checkout requires a matching secret-key prefix and session `livemode`, and the webhook rejects wrong-mode events/sessions before database access. Live payments require explicit `STRIPE_MODE=live` plus matching live secrets.
- Test payments still create normal donation records and send real thank-you emails; use a separate test project/wall and controlled email addresses.
- Payment mode regression tests: `node --test supabase/functions/stripe-mode.test.mjs` (Node.js 22+ with dependencies installed; Stripe, Supabase, and Deno are mocked, no network calls).

## Email

- Sending domain: `prayerrhythm.com` (verified in Resend)
- FROM_EMAIL secret: `noreply@prayerrhythm.com`
- A 403 from Resend means the sending domain is not verified or FROM_EMAIL doesn't match a verified domain.

---

## Architecture Decisions

Full ADRs are in `docs/decisions/`:
- `001-clean-architecture.md` — layer structure and rules
- `002-prayer-wall-schema.md` — why `prayer_wall` schema, consequences for clients
- `003-mock-vs-supabase-repos.md` — repository wiring pattern and known bug history
