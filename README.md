# Prayer Wall

Prayer Wall is a React + TypeScript app built with Vite. It supports running against Supabase **or** in a fully in-memory **mock mode** for local development.

## Prerequisites

- Node.js (LTS recommended)
- npm
- Supabase CLI (`npm i -g supabase`)

## Quick start (mock mode — no Supabase required)

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create your local env file:

   - Copy `.env.example` to `.env.local`
   - Set `VITE_USE_MOCK=true`

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open the URL printed by Vite (usually `http://localhost:5173`).

## Running with Supabase

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and set:

   - `VITE_USE_MOCK=false`
   - `VITE_SUPABASE_URL` — your Supabase project URL (`https://swrcawckpsotialqnisq.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` — your anon/public key
   - `VITE_ORG_ID` — UUID of the organisation record
   - `VITE_WALL_ID` — UUID of the wall record
   - `VITE_ORG_NAME` — optional display name

3. Start the dev server:

   ```bash
   npm run dev
   ```

Supabase setup notes live in:

- `docs/supabase-setup.md`
- `docs/architecture.md`

## Database migrations

All migrations are in `supabase/migrations/`. To apply pending migrations to the remote database:

```bash
npx supabase db push --project-ref swrcawckpsotialqnisq
```

| Migration | Description |
|-----------|-------------|
| 001 | Initial schema (`prayer_wall` schema, core tables, RLS) |
| 002–017 | Incremental schema additions (categories, rhythms, themes, etc.) |
| 018 | Add `email_type` column to `email_logs` |
| 019 | Grant `service_role` usage on `prayer_wall` schema (required for Edge Functions) |

## Edge Functions

Deployed to Supabase project `swrcawckpsotialqnisq`. To deploy:

```bash
npx supabase functions deploy send-confirmation --project-ref swrcawckpsotialqnisq
npx supabase functions deploy send-reminders --project-ref swrcawckpsotialqnisq
```

### Required secrets

Set via `npx supabase secrets set --project-ref swrcawckpsotialqnisq KEY=value`:

| Secret | Description |
|--------|-------------|
| `RESEND_API_KEY` | Resend API key (full sending access) |
| `FROM_EMAIL` | Verified sender address in Resend |
| `APP_URL` | Production app URL (used for unsubscribe links) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the runtime.

### send-confirmation

Triggered from the frontend after a commitment is created. Sends two emails via Resend:
1. Confirmation — "Your stone has been placed"
2. Prayer & meditation summary

### send-reminders

Scheduled via pg_cron. Sends prayer reminder emails to active commitments based on configured email rhythms.

## Email (Resend)

- Sender domain must be verified at `https://resend.com/domains`
- API key must have full sending access (`https://resend.com/api-keys`)
- See `docs/email-confirmation-spec.md` and `docs/email-rhythm-mechanism.md` for full details

## Environment variables

This app uses Vite env vars (must be prefixed with `VITE_`). See `.env.example` for the canonical list.

- `VITE_USE_MOCK`
  - `true`: runs entirely without Supabase (all data in-memory)
  - `false`: requires Supabase env vars below
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (required when not in mock mode)
- `VITE_ORG_ID` / `VITE_WALL_ID` (used to scope wall + categories)
- `VITE_ORG_NAME` (optional)

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck + production build
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint

## Deployment

This repo deploys to Railway via `railway.json`. Supabase Edge Functions and schema migrations are managed separately via the Supabase CLI — see the `supabase/` directory.
