-- Operational maintenance script, NOT a schema migration.
-- Save the job IDs and their original active values BEFORE running the changes.
SELECT jobid, jobname, active FROM cron.job WHERE jobname = 'send-prayer-reminders';

BEGIN;
-- Blocks browser/API prayer signups, including cached pages. Service-role
-- functions bypass RLS: stop checkout, webhooks, and in-flight sends separately.
-- Wall IDs confirmed by the user; these match 01_snapshot.sql.
CREATE POLICY cutover_block_new_signups ON prayer_wall.commitments
AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (wall_id <> ALL (ARRAY[
  '00000000-0000-0000-0000-000000000002'::uuid,
  '25bc7657-e323-47e6-b8a0-c88db46a8250'::uuid
]));

SELECT cron.alter_job(jobid, active := false)
FROM cron.job WHERE jobname = 'send-prayer-reminders' AND active;
COMMIT;
