-- Purge test donations — STEP 3 of 3: RESTORE (undo, only if needed).
--
-- Copies rows from purge_backup.* back into prayer_wall.*. Parents first.
-- ON CONFLICT DO NOTHING makes it safe to run twice. Runs as one transaction.
-- Relies on the backup tables having the same columns as the live ones; if the
-- schema changed since the purge, restore with an explicit column list instead.
--
-- Once you are certain the purge was right, drop the backup (this is permanent):
--   DROP SCHEMA purge_backup CASCADE;
-- It holds donor names and emails, so do not leave it around indefinitely.

BEGIN;

INSERT INTO prayer_wall.commitments    SELECT * FROM purge_backup.commitments    ON CONFLICT DO NOTHING;
INSERT INTO prayer_wall.donations      SELECT * FROM purge_backup.donations      ON CONFLICT DO NOTHING;
INSERT INTO prayer_wall.webhook_events SELECT * FROM purge_backup.webhook_events ON CONFLICT DO NOTHING;
INSERT INTO prayer_wall.email_logs     SELECT * FROM purge_backup.email_logs     ON CONFLICT DO NOTHING;

COMMIT;
