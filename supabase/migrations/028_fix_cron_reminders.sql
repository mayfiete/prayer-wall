-- Migration 028: repair the send-reminders pg_cron job
--
-- Migration 012 scheduled the job using current_setting('app.supabase_url') and
-- current_setting('app.cron_secret') — custom GUCs that nothing in this repo
-- ever sets. Every hourly run since has failed on the first statement:
--
--   ERROR: unrecognized configuration parameter "app.supabase_url"
--
-- net._http_response is empty and prayer_wall.email_logs contains only
-- 'confirmation' and 'summary' rows, confirming no reminder has ever been sent.
--
-- This switches the job to Supabase Vault, which is what docs/architecture.md
-- and docs/supabase-setup.md already describe. Migration 012 was the outlier.
--
-- ── BEFORE running this ───────────────────────────────────────────────────────
-- Create the two Vault secrets (Dashboard → Project Settings → Vault, or here).
-- Generate the cron secret with: openssl rand -hex 32
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random-hex>', 'cron_secret');
--
-- ── AFTER running this ────────────────────────────────────────────────────────
-- Set the matching edge function secret, or the function will reject the call
-- with 401 (see send-reminders/index.ts, the CRON_SECRET check):
--
--   npx supabase secrets set CRON_SECRET=<same value as the cron_secret above>

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Refuse to reschedule into the same silent-failure state migration 012 left us
-- in: if the Vault secrets are missing, stop here with a readable message.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url')
     OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_secret') THEN
    RAISE EXCEPTION
      'Vault secrets project_url and cron_secret must exist before running this migration — see the header.';
  END IF;
END
$do$;

-- Idempotent unschedule: matching on jobname avoids an error when absent.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send-prayer-reminders';

-- Hourly is deliberate: send-reminders does its own per-rhythm timezone
-- conversion and expects to be woken every hour to decide who is due.
SELECT cron.schedule(
  'send-prayer-reminders',
  '0 * * * *',
  $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);

-- ── Verify ────────────────────────────────────────────────────────────────────
-- Wait for the next hour boundary, then expect status = 'succeeded' here:
--
--   SELECT status, return_message, start_time
--     FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
--
-- and a 200 (not 401) from the function itself:
--
--   SELECT status_code, left(content, 200), created
--     FROM net._http_response ORDER BY created DESC LIMIT 5;
