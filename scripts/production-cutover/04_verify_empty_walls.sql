-- Read-only verification after committing the cleanup and before real signups.
SELECT w.id, w.name, w.app_type,
  (SELECT count(*) FROM prayer_wall.commitments c WHERE c.wall_id = w.id) AS signups,
  (SELECT count(*) FROM prayer_wall.donations d WHERE d.giving_wall_id = w.id) AS donations,
  (SELECT count(*) FROM prayer_wall.email_logs e WHERE e.wall_id = w.id OR e.giving_wall_id = w.id) AS email_logs
FROM prayer_wall.walls w
WHERE w.id IN ('00000000-0000-0000-0000-000000000002'::uuid,
               '25bc7657-e323-47e6-b8a0-c88db46a8250'::uuid)
ORDER BY w.app_type;

-- Should remain paused until the final launch step.
SELECT jobid, jobname, active FROM cron.job WHERE jobname = 'send-prayer-reminders';

-- Present while signup maintenance is enabled; removed deliberately at launch.
SELECT policyname FROM pg_policies
WHERE schemaname = 'prayer_wall' AND tablename = 'commitments'
  AND policyname = 'cutover_block_new_signups';
