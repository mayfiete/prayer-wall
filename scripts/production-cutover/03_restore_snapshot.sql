-- Emergency restoration BEFORE reopening signups, checkout, or reminders.
-- DRY RUN BY DEFAULT. Requires the SAME unchanged schema and stopped writers.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE IF NOT EXISTS cutover_state (snapshot jsonb);
TRUNCATE pg_temp.cutover_state;

INSERT INTO pg_temp.cutover_state VALUES (
$snapshot$PASTE_COMPLETE_SNAPSHOT_JSON_HERE$snapshot$::jsonb
);
-- Temporary helper: creates no permanent tables or functions.
CREATE OR REPLACE FUNCTION pg_temp.cutover_capture(wall_ids uuid[])
RETURNS jsonb LANGUAGE sql AS $capture$
  SELECT jsonb_build_object(
    'commitments', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM prayer_wall.commitments t WHERE t.wall_id = ANY(wall_ids)),
    'donations', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM prayer_wall.donations t WHERE t.giving_wall_id = ANY(wall_ids)),
    'commitment_categories', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM prayer_wall.commitment_categories t WHERE t.commitment_id IN (SELECT id FROM prayer_wall.commitments WHERE wall_id = ANY(wall_ids))),
    'commitment_rhythms', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM prayer_wall.commitment_rhythms t WHERE t.commitment_id IN (SELECT id FROM prayer_wall.commitments WHERE wall_id = ANY(wall_ids))),
    'prayer_points', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM prayer_wall.prayer_points t WHERE t.commitment_id IN (SELECT id FROM prayer_wall.commitments WHERE wall_id = ANY(wall_ids))),
    'email_logs', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM prayer_wall.email_logs t WHERE t.wall_id = ANY(wall_ids) OR t.giving_wall_id = ANY(wall_ids) OR t.commitment_id IN (SELECT id FROM prayer_wall.commitments WHERE wall_id = ANY(wall_ids)) OR t.donation_id IN (SELECT id FROM prayer_wall.donations WHERE giving_wall_id = ANY(wall_ids))),
    'webhook_events', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM prayer_wall.webhook_events t WHERE t.giving_wall_id = ANY(wall_ids) OR t.donation_id IN (SELECT id FROM prayer_wall.donations WHERE giving_wall_id = ANY(wall_ids)))
  );
$capture$;

LOCK TABLE prayer_wall.commitments, prayer_wall.donations,
  prayer_wall.commitment_categories, prayer_wall.commitment_rhythms,
  prayer_wall.prayer_points, prayer_wall.email_logs, prayer_wall.webhook_events
IN SHARE ROW EXCLUSIVE MODE;

DO $restore$
DECLARE doc jsonb; wall_ids uuid[]; current_tables jsonb; table_name text; restored_count bigint;
BEGIN
  SELECT snapshot INTO doc FROM pg_temp.cutover_state;
  IF doc->>'format' IS DISTINCT FROM 'prayer-wall-cleanup-v1'
     OR jsonb_typeof(doc->'wall_ids') IS DISTINCT FROM 'array'
     OR jsonb_typeof(doc->'tables') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid snapshot. Paste the complete JSON from 01_snapshot.sql.';
  END IF;
  SELECT ARRAY(SELECT jsonb_array_elements_text(snapshot->'wall_ids')::uuid) INTO wall_ids FROM pg_temp.cutover_state;
  IF cardinality(wall_ids) = 0 OR cardinality(wall_ids) <>
     (SELECT count(*) FROM prayer_wall.walls WHERE id = ANY(wall_ids)) THEN
    RAISE EXCEPTION 'Wall IDs are empty, duplicated, or do not match this project.';
  END IF;

  current_tables := pg_temp.cutover_capture(wall_ids);
  FOREACH table_name IN ARRAY ARRAY['commitments', 'donations', 'commitment_categories', 'commitment_rhythms', 'prayer_points', 'email_logs'] LOOP
    IF jsonb_typeof(doc->'tables'->table_name) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Missing backup for %', table_name;
    END IF;
    IF jsonb_array_length(current_tables->table_name) <> 0 THEN
      RAISE EXCEPTION 'Selected walls are not empty. Do not merge a test backup into live data.';
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY['commitments', 'donations', 'commitment_categories', 'commitment_rhythms', 'prayer_points', 'email_logs'] LOOP
    EXECUTE format(
      'INSERT INTO prayer_wall.%I SELECT * FROM jsonb_populate_recordset(NULL::prayer_wall.%I, $1)',
      table_name, table_name
    ) USING doc->'tables'->table_name;
    GET DIAGNOSTICS restored_count = ROW_COUNT;
    IF restored_count <> jsonb_array_length(doc->'tables'->table_name) THEN
      RAISE EXCEPTION 'Unexpected restoration count for %', table_name;
    END IF;
    RAISE NOTICE '%: % rows would be/restored', table_name, restored_count;
  END LOOP;
  -- Reattach preserved webhook audit rows without overwriting their status/history.
  current_tables := pg_temp.cutover_capture(wall_ids);
  FOREACH table_name IN ARRAY ARRAY['commitments', 'donations', 'commitment_categories', 'commitment_rhythms', 'prayer_points', 'email_logs'] LOOP
    IF current_tables->table_name IS DISTINCT FROM doc->'tables'->table_name THEN
      RAISE EXCEPTION 'Restored rows in % do not match the snapshot. Entire transaction must roll back.', table_name;
    END IF;
  END LOOP;
  UPDATE prayer_wall.webhook_events e
  SET donation_id = (old.value->>'donation_id')::uuid
  FROM jsonb_array_elements(doc->'tables'->'webhook_events') old
  WHERE e.id = (old.value->>'id')::uuid
    AND e.donation_id IS NULL AND old.value->>'donation_id' IS NOT NULL;
END $restore$;
-- Review dry-run counts, then change only this final statement to COMMIT if needed.
ROLLBACK;

