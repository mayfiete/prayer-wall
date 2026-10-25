-- Purge test donations — STEP 2 of 3: PURGE (guarded, backed up, atomic).
--
-- Run 01_preview.sql first. Then edit the three settings below.
-- The whole script is ONE DO block, so it is a single transaction: any failed
-- guard rolls back everything.
--
-- Safety design:
--   * Dry run by default (v_dry_run := true): does all the work, then forces a
--     rollback and reports what it WOULD have done. Set to false to commit.
--   * v_expected_donations must equal the preview's section B row count, or abort.
--   * Only livemode=false rows are selected; aborts if any candidate also has a
--     non-test event, a non-giving wall, or dependent prayer data.
--   * Every deleted row is first copied to purge_backup.* (a schema that is not
--     exposed through the API). 03_restore.sql puts them back.
--
-- Deletion order matters: webhook_events.donation_id / email_logs.donation_id
-- are ON DELETE SET NULL, so classification is done before anything is removed;
-- donations -> commitments is ON DELETE RESTRICT, so donations go first.

CREATE SCHEMA IF NOT EXISTS purge_backup;
REVOKE ALL ON SCHEMA purge_backup FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS purge_backup.donations      (LIKE prayer_wall.donations      INCLUDING ALL);
CREATE TABLE IF NOT EXISTS purge_backup.commitments    (LIKE prayer_wall.commitments    INCLUDING ALL);
CREATE TABLE IF NOT EXISTS purge_backup.webhook_events (LIKE prayer_wall.webhook_events INCLUDING ALL);
CREATE TABLE IF NOT EXISTS purge_backup.email_logs     (LIKE prayer_wall.email_logs     INCLUDING ALL);
REVOKE ALL ON ALL TABLES IN SCHEMA purge_backup FROM PUBLIC, anon, authenticated;

DO $purge$
DECLARE
  -- ── EDIT THESE ──────────────────────────────────────────────────────────────
  v_dry_run            boolean := true;   -- true = report and roll back; false = commit
  v_expected_donations integer := 26;     -- row count of preview section B (+ extras below)
  v_extra_donation_ids uuid[]  := '{}';   -- reviewed test donations with no webhook row (preview C)
  -- ────────────────────────────────────────────────────────────────────────────

  v_don_ids uuid[];
  v_com_ids uuid[];
  v_n       integer;
  v_tbl     text;
  c_events  integer;
  c_logs    integer;
  c_dons    integer;
  c_coms    integer;
BEGIN
  IF v_expected_donations IS NULL THEN
    RAISE EXCEPTION 'Set v_expected_donations to the preview section B row count (plus any extra ids).';
  END IF;

  -- Candidates: donations whose webhook audit says livemode=false, plus reviewed extras.
  SELECT coalesce(array_agg(DISTINCT id), '{}') INTO v_don_ids
  FROM (
    SELECT donation_id AS id FROM prayer_wall.webhook_events
     WHERE donation_id IS NOT NULL AND raw_payload->>'livemode' = 'false'
    UNION
    SELECT unnest(v_extra_donation_ids)
  ) s;

  IF coalesce(array_length(v_don_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No test donations found; nothing to do.';
  END IF;

  IF array_length(v_don_ids, 1) <> v_expected_donations THEN
    RAISE EXCEPTION 'Found % candidate donations but v_expected_donations = %. Re-run the preview.',
      array_length(v_don_ids, 1), v_expected_donations;
  END IF;

  SELECT count(*) INTO v_n FROM prayer_wall.donations WHERE id = ANY (v_don_ids);
  IF v_n <> array_length(v_don_ids, 1) THEN
    RAISE EXCEPTION 'v_extra_donation_ids contains ids that are not in prayer_wall.donations.';
  END IF;

  -- Guard: no candidate may be tied to a live (or unflagged) event.
  SELECT count(*) INTO v_n FROM prayer_wall.webhook_events
   WHERE donation_id = ANY (v_don_ids) AND raw_payload->>'livemode' IS DISTINCT FROM 'false';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ABORT: % webhook event(s) for candidate donations are not livemode=false.', v_n;
  END IF;

  -- Commitments owned by the candidate donations (the "test payers").
  SELECT coalesce(array_agg(DISTINCT commitment_id), '{}') INTO v_com_ids
  FROM prayer_wall.donations
  WHERE id = ANY (v_don_ids) AND commitment_id IS NOT NULL;

  -- Guard: payer commitments must belong to a giving wall...
  SELECT count(*) INTO v_n
  FROM prayer_wall.commitments c
  JOIN prayer_wall.walls w ON w.id = c.wall_id
  WHERE c.id = ANY (v_com_ids) AND w.app_type IS DISTINCT FROM 'giving';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ABORT: % candidate commitment(s) are not on a giving wall.', v_n;
  END IF;

  -- ...must not be shared with a donation we are keeping...
  SELECT count(*) INTO v_n FROM prayer_wall.donations
   WHERE commitment_id = ANY (v_com_ids) AND NOT (id = ANY (v_don_ids));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ABORT: % kept donation(s) share a candidate commitment.', v_n;
  END IF;

  -- ...and must have no prayer data that deleting the commitment would cascade into.
  FOREACH v_tbl IN ARRAY ARRAY['commitment_categories', 'commitment_rhythms', 'prayer_points'] LOOP
    IF to_regclass('prayer_wall.' || v_tbl) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM prayer_wall.%I WHERE commitment_id = ANY ($1)', v_tbl)
        INTO v_n USING v_com_ids;
      IF v_n > 0 THEN
        RAISE EXCEPTION 'ABORT: % row(s) in % depend on candidate commitments.', v_n, v_tbl;
      END IF;
    END IF;
  END LOOP;

  -- ── Back up, then delete (children first) ───────────────────────────────────
  INSERT INTO purge_backup.commitments
    SELECT * FROM prayer_wall.commitments WHERE id = ANY (v_com_ids) ON CONFLICT DO NOTHING;
  INSERT INTO purge_backup.donations
    SELECT * FROM prayer_wall.donations WHERE id = ANY (v_don_ids) ON CONFLICT DO NOTHING;
  INSERT INTO purge_backup.webhook_events
    SELECT * FROM prayer_wall.webhook_events
     WHERE raw_payload->>'livemode' = 'false' OR donation_id = ANY (v_don_ids)
    ON CONFLICT DO NOTHING;
  INSERT INTO purge_backup.email_logs
    SELECT * FROM prayer_wall.email_logs WHERE donation_id = ANY (v_don_ids) ON CONFLICT DO NOTHING;

  DELETE FROM prayer_wall.email_logs WHERE donation_id = ANY (v_don_ids);
  GET DIAGNOSTICS c_logs = ROW_COUNT;

  DELETE FROM prayer_wall.webhook_events
   WHERE raw_payload->>'livemode' = 'false' OR donation_id = ANY (v_don_ids);
  GET DIAGNOSTICS c_events = ROW_COUNT;

  DELETE FROM prayer_wall.donations WHERE id = ANY (v_don_ids);
  GET DIAGNOSTICS c_dons = ROW_COUNT;

  DELETE FROM prayer_wall.commitments WHERE id = ANY (v_com_ids);
  GET DIAGNOSTICS c_coms = ROW_COUNT;

  IF c_dons <> v_expected_donations THEN
    RAISE EXCEPTION 'Deleted % donations, expected %. Rolled back.', c_dons, v_expected_donations;
  END IF;

  IF v_dry_run THEN
    RAISE EXCEPTION 'DRY RUN OK, rolled back. Would delete: % donations, % commitments, % webhook_events, % email_logs. Set v_dry_run := false to commit.',
      c_dons, c_coms, c_events, c_logs;
  END IF;

  RAISE NOTICE 'PURGED: % donations, % commitments, % webhook_events, % email_logs. Backup in purge_backup.*',
    c_dons, c_coms, c_events, c_logs;
END
$purge$;

-- After a real run, confirm the live count from preview section F is unchanged:
-- SELECT count(*) FROM prayer_wall.donations;
-- SELECT count(*) FROM purge_backup.donations;
