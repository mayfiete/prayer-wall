# Supabase Setup Guide

Follow these steps in order. Each step builds on the previous one.

---

## Prerequisites

- A [Supabase](https://supabase.com) account (free)
- A [Resend](https://resend.com) account (free) with a verified sending domain
- The codebase cloned locally with `npm install` completed

---

## Step 1 — Create the Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) → **New project**
2. Choose your organization, set a project name (e.g. `prayer-wall`), pick a strong database password, and select a region close to your users
3. Wait ~2 minutes for the project to initialize
4. Once active, go to **Project Settings → API** and copy:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon / public key** — the `anon` key under *Project API keys*

---

## Step 2 — Run the database migration

1. In the Supabase dashboard, open **SQL Editor**
2. Click **New query**
3. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run**

This creates all tables, indexes, RLS policies, column-level grants, and seeds a default church with 8 prayer categories.

> **Verify:** Go to **Table Editor** — you should see `churches`, `prayer_categories`, `prayer_commitments`, `prayer_commitment_categories`, and `email_logs`.

---

## Step 3 — Note your church ID

The migration seeds a church with ID `00000000-0000-0000-0000-000000000001`. You will use this as `VITE_CHURCH_ID` in your `.env` file.

If you want a different church, run:

```sql
INSERT INTO churches (name, slug) VALUES ('Your Church Name', 'your-church')
RETURNING id;
```

Copy the returned UUID — that becomes your `VITE_CHURCH_ID`.

---

## Step 4 — Configure your frontend environment

Copy `.env.example` to `.env.local` in the project root:

```bash
cp .env.example .env.local
```

Fill in the values:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR...
VITE_CHURCH_ID=00000000-0000-0000-0000-000000000001
```

Run the app locally to verify the wall loads:

```bash
npm run dev
```

---

## Step 5 — Enable Realtime on the commitments table

1. In the Supabase dashboard, go to **Database → Replication**
2. Under **Supabase Realtime**, find `prayer_commitments` and toggle it **on**

> The migration already runs `ALTER PUBLICATION supabase_realtime ADD TABLE prayer_commitments`, so this may already be enabled. Verify it shows as active.

---

## Step 6 — Set up Supabase Vault secrets

The pg_cron job and Edge Functions use Vault to store secrets securely.

1. Go to **Project Settings → Vault**
2. Click **New secret** and add the following:

| Name | Value |
|---|---|
| `project_url` | Your Supabase project URL (same as `VITE_SUPABASE_URL`) |
| `cron_secret` | A random secret — generate with `openssl rand -hex 32` |
| `anon_key` | Your Supabase anon key (used by pg_cron if needed) |

Keep the `cron_secret` value — you'll need it again in Step 8.

---

## Step 7 — Schedule the weekly reminder with pg_cron

1. In **SQL Editor**, run the following. Adjust the time as needed.

```sql
-- Monday 9 AM Eastern (EDT, UTC-4)
-- Change to '0 14 * * 1' in winter (EST, UTC-5)
select cron.schedule(
  'weekly-prayer-reminders',
  '0 13 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

2. Verify the job was created:

```sql
select jobname, schedule, active from cron.job;
```

> **To unschedule:** `select cron.unschedule('weekly-prayer-reminders');`

---

## Step 8 — Deploy the Edge Functions

Make sure you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed:

```bash
npm install -g supabase
```

Link your project (run from the `prayer-wall` project root):

```bash
supabase login
supabase link --project-ref xxxxxxxxxxxx
```

Deploy both functions:

```bash
supabase functions deploy send-reminders --no-verify-jwt
supabase functions deploy unsubscribe --no-verify-jwt
```

> `send-reminders` uses `--no-verify-jwt` because it's called by pg_cron, not by a logged-in user. It validates the `x-cron-secret` header instead.

---

## Step 9 — Set Edge Function secrets

```bash
supabase secrets set CRON_SECRET=<your-cron-secret-from-step-6>
supabase secrets set RESEND_API_KEY=<your-resend-api-key>
supabase secrets set APP_URL=https://your-service.up.railway.app
```

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically injected into Edge Functions — you do not need to set them manually.

Verify secrets are set:

```bash
supabase secrets list
```

---

## Step 10 — Update the email sender address

In `supabase/functions/send-reminders/index.ts`, update the `from` field to a verified sender on your Resend domain:

```typescript
from: "Prayer Wall <reminders@your-verified-domain.com>",
```

Redeploy after editing:

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

---

## Step 11 — Test the reminder function manually

Invoke the function directly to confirm emails send before waiting for the cron schedule:

```bash
supabase functions invoke send-reminders \
  --no-verify-jwt \
  --headers '{"x-cron-secret": "<your-cron-secret>"}'
```

Expected response:

```json
{ "sent": 1, "failed": 0, "total": 1 }
```

Check `email_logs` in Table Editor to confirm the log entry was written.

---

## Step 12 — (Optional) Monitor cron run history

```sql
select
  jobname,
  start_time,
  end_time,
  status,
  return_message
from cron.job_run_details
order by start_time desc
limit 20;
```

---

## Step 13 — Deploy the frontend to Railway

The repo includes a `railway.json` that configures the build and start commands automatically. Railway will pick it up with no extra setup.

1. Push the repository to GitHub (or GitLab)
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
3. Select your repository and let Railway detect it as a Node.js project via Nixpacks
4. In the service **Variables** tab, add:
   ```
   VITE_USE_MOCK          = false
   VITE_SUPABASE_URL      = https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR...
   VITE_CHURCH_ID         = 00000000-0000-0000-0000-000000000001
   ```
5. Click **Deploy** — Railway runs `npm run build` then starts `npx serve dist -s`

Railway auto-assigns a public URL in the format `https://your-service.up.railway.app`. Copy this URL — you'll need it for the `APP_URL` Edge Function secret in Step 9.

> **Custom domain:** In the Railway service settings under **Networking**, add your own domain and Railway will provision a TLS certificate automatically.

---

## Quick reference: all secrets and env vars

| Where | Name | Description |
|---|---|---|
| `.env.local` (frontend) | `VITE_SUPABASE_URL` | Supabase project URL |
| `.env.local` (frontend) | `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `.env.local` (frontend) | `VITE_CHURCH_ID` | UUID of your church row |
| Supabase Vault | `project_url` | Supabase project URL (for pg_cron) |
| Supabase Vault | `cron_secret` | Shared secret for pg_cron → Edge Function auth |
| Edge Function secrets | `CRON_SECRET` | Same value as Vault `cron_secret` |
| Edge Function secrets | `RESEND_API_KEY` | Resend API key |
| Edge Function secrets | `APP_URL` | Your Railway service URL (`https://your-service.up.railway.app`) |
| Railway service vars | `VITE_SUPABASE_URL` | Same as `.env.local` |
| Railway service vars | `VITE_SUPABASE_ANON_KEY` | Same as `.env.local` |
| Railway service vars | `VITE_CHURCH_ID` | Same as `.env.local` |
| Railway service vars | `VITE_USE_MOCK` | Must be `false` in production |
