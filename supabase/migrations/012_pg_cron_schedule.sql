-- ============================================================
-- pg_cron: schedule send-reminders edge function hourly
--
-- pg_cron runs in the postgres schema. The job calls the
-- send-reminders edge function via pg_net (HTTP from DB).
--
-- Required Supabase secrets (set via Dashboard or CLI):
--   CRON_SECRET   - shared secret header value
--   APP_URL       - your deployed app URL (for unsubscribe links)
--   RESEND_API_KEY - from resend.com
--   FROM_EMAIL    - e.g. noreply@yourdomain.com
-- ============================================================

-- Enable pg_cron and pg_net extensions (safe to run if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: runs at the top of every hour, every day
-- pg_cron uses UTC; the edge function does timezone conversion per rhythm
SELECT cron.schedule(
  'send-prayer-reminders',         -- job name (unique)
  '0 * * * *',                     -- every hour on the hour
  $$
  SELECT net.http_post(
    url     := (SELECT current_setting('app.supabase_url') || '/functions/v1/send-reminders'),
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  current_setting('app.cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
