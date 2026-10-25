-- Purge test prayers — STEP 3 of 3: RESTORE (undo, only if needed).
--
-- Copies rows from purge_backup.prayer_* back into prayer_wall.*, parents
-- first. ON CONFLICT DO NOTHING makes it safe to run twice. One transaction.
-- Relies on the backup tables having the same columns as the live ones; if the
-- schema changed since the purge, restore with an explicit column list instead.
--
-- Once you are certain the purge was right, drop the backup (permanent):
--   DROP TABLE purge_backup.prayer_email_logs, purge_backup.prayer_prayer_points,
--              purge_backup.prayer_commitment_rhythms,
--              purge_backup.prayer_commitment_categories,
--              purge_backup.prayer_commitments;
-- It holds names and emails, so do not leave it around indefinitely.

BEGIN;

INSERT INTO prayer_wall.commitments            SELECT * FROM purge_backup.prayer_commitments            ON CONFLICT DO NOTHING;
INSERT INTO prayer_wall.commitment_categories  SELECT * FROM purge_backup.prayer_commitment_categories  ON CONFLICT DO NOTHING;
INSERT INTO prayer_wall.commitment_rhythms     SELECT * FROM purge_backup.prayer_commitment_rhythms     ON CONFLICT DO NOTHING;
INSERT INTO prayer_wall.prayer_points          SELECT * FROM purge_backup.prayer_prayer_points          ON CONFLICT DO NOTHING;
INSERT INTO prayer_wall.email_logs             SELECT * FROM purge_backup.prayer_email_logs             ON CONFLICT DO NOTHING;

COMMIT;
