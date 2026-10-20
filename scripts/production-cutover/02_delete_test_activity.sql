-- DRY RUN BY DEFAULT: last statement is ROLLBACK.
-- Never run until test Stripe deliveries and all other writers are stopped.
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

DO $delete$
DECLARE
  doc jsonb;
  wall_ids uuid[];
  current_tables jsonb;
  table_name text;
  deleted_count bigint;
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
  IF current_tables IS DISTINCT FROM doc->'tables' THEN
    RAISE EXCEPTION 'Database changed since the snapshot. Nothing deleted. Stop writers, capture and review a fresh snapshot.';
  END IF;
  -- Refuse cleanup if a later schema change introduced a dependent table
  -- that this backup does not include. Never silently cascade into new tables.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid IN ('prayer_wall.commitments'::regclass,
        'prayer_wall.donations'::regclass, 'prayer_wall.commitment_categories'::regclass,
        'prayer_wall.commitment_rhythms'::regclass, 'prayer_wall.prayer_points'::regclass,
        'prayer_wall.email_logs'::regclass)
      AND conrelid NOT IN ('prayer_wall.commitments'::regclass,
        'prayer_wall.donations'::regclass, 'prayer_wall.commitment_categories'::regclass,
        'prayer_wall.commitment_rhythms'::regclass, 'prayer_wall.prayer_points'::regclass,
        'prayer_wall.email_logs'::regclass, 'prayer_wall.webhook_events'::regclass)
  ) THEN
    RAISE EXCEPTION 'An unreviewed table depends on this activity. Update the backup/cleanup plan first.';
  END IF;
  -- Exact snapshot match is required. Roots are deleted by backed-up IDs only.
  FOREACH table_name IN ARRAY ARRAY['email_logs', 'commitment_categories', 'commitment_rhythms', 'prayer_points', 'donations', 'commitments'] LOOP
    IF table_name IN ('commitment_categories', 'commitment_rhythms') THEN
      EXECUTE format(
        'DELETE FROM prayer_wall.%I WHERE commitment_id IN (SELECT (value->>''id'')::uuid FROM jsonb_array_elements($1))',
        table_name
      ) USING doc->'tables'->'commitments';
    ELSE
      EXECUTE format(
        'DELETE FROM prayer_wall.%I WHERE id IN (SELECT (value->>''id'')::uuid FROM jsonb_array_elements($1))',
        table_name
      ) USING doc->'tables'->table_name;
    END IF;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count <> jsonb_array_length(doc->'tables'->table_name) THEN
      RAISE EXCEPTION 'Unexpected deletion count for %. Entire transaction must roll back.', table_name;
    END IF;
    RAISE NOTICE '%: % rows would be/deleted', table_name, deleted_count;
  END LOOP;
  current_tables := pg_temp.cutover_capture(wall_ids);
  FOREACH table_name IN ARRAY ARRAY['email_logs', 'commitment_categories', 'commitment_rhythms', 'prayer_points', 'donations', 'commitments'] LOOP
    IF jsonb_array_length(current_tables->table_name) <> 0 THEN
      RAISE EXCEPTION 'Rows remain in %. Entire transaction must roll back.', table_name;
    END IF;
  END LOOP;
  -- Webhook events are retained; their donation_id FK may become NULL.
END $delete$;

-- FIRST RUN: leave this as ROLLBACK. Review the NOTICE counts.
-- APPROVED EXECUTION ONLY: replace this single ROLLBACK with COMMIT.
ROLLBACK;

