-- Purge test prayers — STEP 2 of 3: PURGE (guarded, backed up, atomic).
--
-- Run 01_preview.sql first. Then edit the settings below.
-- The whole script is ONE DO block, so it is a single transaction: any failed
-- guard rolls back everything.
--
-- Safety design:
--   * Dry run by default (v_dry_run := true): does all the work, then forces a
--     rollback and reports what it WOULD have done. Set to false to commit.
--   * v_expected_commitments must equal the preview's section B row count.
--   * Only walls with app_type = 'prayer' are in scope; aborts if any in-scope
--     commitment is tied to a donation.
--   * Every deleted row is first copied to purge_backup.prayer_* (a schema that
--     is not exposed through the API). 03_restore.sql puts them back.
--   * Configuration (walls, categories, rhythms, meditations, themes, email
--     copy) is never deleted.
--
-- Note: removing commitments also stops their reminder emails, since
-- send-reminders only emails existing commitments.

CREATE SCHEMA IF NOT EXISTS purge_backup;
REVOKE ALL ON SCHEMA purge_backup FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS purge_backup.prayer_commitments           (LIKE prayer_wall.commitments            INCLUDING ALL);
CREATE TABLE IF NOT EXISTS purge_backup.prayer_commitment_categories (LIKE prayer_wall.commitment_categories  INCLUDING ALL);
CREATE TABLE IF NOT EXISTS purge_backup.prayer_commitment_rhythms    (LIKE prayer_wall.commitment_rhythms     INCLUDING ALL);
CREATE TABLE IF NOT EXISTS purge_backup.prayer_prayer_points         (LIKE prayer_wall.prayer_points          INCLUDING ALL);
CREATE TABLE IF NOT EXISTS purge_backup.prayer_email_logs            (LIKE prayer_wall.email_logs             INCLUDING ALL);
REVOKE ALL ON ALL TABLES IN SCHEMA purge_backup FROM PUBLIC, anon, authenticated;

DO $purge$
DECLARE
  -- ── EDIT THESE ──────────────────────────────────────────────────────────────
  v_dry_run              boolean := true;   -- true = report and roll back; false = commit
  v_expected_commitments integer := NULL;   -- row count of preview section B
  v_only_wall_id         uuid    := NULL;   -- NULL = every prayer wall; or one wall id
  -- ────────────────────────────────────────────────────────────────────────────

  v_wall_ids uuid[];
  v_com_ids  uuid[];
  v_n        integer;
  c_logs     integer;
  c_points   integer;
  c_rhythms  integer;
  c_cats     integer;
  c_coms     integer;
BEGIN
  IF v_expected_commitments IS NULL THEN
    RAISE EXCEPTION 'Set v_expected_commitments to the preview section B row count.';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_wall_ids
  FROM prayer_wall.walls
  WHERE app_type = 'prayer' AND (v_only_wall_id IS NULL OR id = v_only_wall_id);

  IF coalesce(array_length(v_wall_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No prayer walls matched (check v_only_wall_id and walls.app_type).';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_com_ids
  FROM prayer_wall.commitments WHERE wall_id = ANY (v_wall_ids);

  IF coalesce(array_length(v_com_ids, 1), 0) <> v_expected_commitments THEN
    RAISE EXCEPTION 'Found % commitments but v_expected_commitments = %. Re-run the preview.',
      coalesce(array_length(v_com_ids, 1), 0), v_expected_commitments;
  END IF;

  -- Guard: nothing here may belong to the giving wall's payments.
  SELECT count(*) INTO v_n FROM prayer_wall.donations WHERE commitment_id = ANY (v_com_ids);
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ABORT: % donation(s) reference prayer-wall commitments.', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM prayer_wall.email_logs
   WHERE (wall_id = ANY (v_wall_ids) OR commitment_id = ANY (v_com_ids))
     AND (donation_id IS NOT NULL OR giving_wall_id IS NOT NULL);
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ABORT: % email_logs row(s) in scope belong to the giving wall.', v_n;
  END IF;

  -- ── Back up (parents are copied too, so restore is complete) ────────────────
  INSERT INTO purge_backup.prayer_commitments
    SELECT * FROM prayer_wall.commitments WHERE id = ANY (v_com_ids) ON CONFLICT DO NOTHING;
  INSERT INTO purge_backup.prayer_commitment_categories
    SELECT * FROM prayer_wall.commitment_categories WHERE commitment_id = ANY (v_com_ids) ON CONFLICT DO NOTHING;
  INSERT INTO purge_backup.prayer_commitment_rhythms
    SELECT * FROM prayer_wall.commitment_rhythms WHERE commitment_id = ANY (v_com_ids) ON CONFLICT DO NOTHING;
  INSERT INTO purge_backup.prayer_prayer_points
    SELECT * FROM prayer_wall.prayer_points WHERE commitment_id = ANY (v_com_ids) ON CONFLICT DO NOTHING;
  INSERT INTO purge_backup.prayer_email_logs
    SELECT * FROM prayer_wall.email_logs
     WHERE wall_id = ANY (v_wall_ids) OR commitment_id = ANY (v_com_ids) ON CONFLICT DO NOTHING;

  -- ── Delete, children first (explicit so each count is reported) ─────────────
  DELETE FROM prayer_wall.email_logs
   WHERE wall_id = ANY (v_wall_ids) OR commitment_id = ANY (v_com_ids);
  GET DIAGNOSTICS c_logs = ROW_COUNT;

  DELETE FROM prayer_wall.prayer_points WHERE commitment_id = ANY (v_com_ids);
  GET DIAGNOSTICS c_points = ROW_COUNT;

  DELETE FROM prayer_wall.commitment_rhythms WHERE commitment_id = ANY (v_com_ids);
  GET DIAGNOSTICS c_rhythms = ROW_COUNT;

  DELETE FROM prayer_wall.commitment_categories WHERE commitment_id = ANY (v_com_ids);
  GET DIAGNOSTICS c_cats = ROW_COUNT;

  DELETE FROM prayer_wall.commitments WHERE id = ANY (v_com_ids);
  GET DIAGNOSTICS c_coms = ROW_COUNT;

  IF c_coms <> v_expected_commitments THEN
    RAISE EXCEPTION 'Deleted % commitments, expected %. Rolled back.', c_coms, v_expected_commitments;
  END IF;

  IF v_dry_run THEN
    RAISE EXCEPTION 'DRY RUN OK, rolled back. Would delete: % commitments, % categories links, % rhythm links, % prayer points, % email_logs. Set v_dry_run := false to commit.',
      c_coms, c_cats, c_rhythms, c_points, c_logs;
  END IF;

  RAISE NOTICE 'PURGED: % commitments, % category links, % rhythm links, % prayer points, % email_logs. Backup in purge_backup.prayer_*',
    c_coms, c_cats, c_rhythms, c_points, c_logs;
END
$purge$;

-- After a real run, confirm:
-- SELECT count(*) FROM prayer_wall.commitments c JOIN prayer_wall.walls w ON w.id = c.wall_id WHERE w.app_type = 'prayer';  -- expect 0
-- SELECT count(*) FROM purge_backup.prayer_commitments;
