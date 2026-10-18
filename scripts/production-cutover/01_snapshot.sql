-- READ-ONLY against application data. Run only after pausing writers.
-- Wall IDs confirmed by the user; these match 00_pause_new_signups.sql.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE IF NOT EXISTS cutover_state (snapshot jsonb);
TRUNCATE pg_temp.cutover_state;

INSERT INTO pg_temp.cutover_state VALUES (jsonb_build_object(
  'format', 'prayer-wall-cleanup-v1',
  'captured_at', now(),
  'wall_ids', to_jsonb(ARRAY['00000000-0000-0000-0000-000000000002'::uuid, '25bc7657-e323-47e6-b8a0-c88db46a8250'::uuid])
));
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

DO $check$
DECLARE wall_ids uuid[];
BEGIN
  SELECT ARRAY(SELECT jsonb_array_elements_text(snapshot->'wall_ids')::uuid) INTO wall_ids FROM pg_temp.cutover_state;
  IF cardinality(wall_ids) <> (SELECT count(*) FROM prayer_wall.walls WHERE id = ANY(wall_ids)) THEN
    RAISE EXCEPTION 'One or more wall IDs are missing or duplicated.';
  END IF;
  UPDATE pg_temp.cutover_state SET snapshot = snapshot || jsonb_build_object(
    'tables', pg_temp.cutover_capture(wall_ids),
    'walls', (SELECT jsonb_agg(to_jsonb(w)) FROM prayer_wall.walls w WHERE w.id = ANY(wall_ids))
  );
END $check$;
COMMIT;
-- Save the COMPLETE snapshot_json cell locally as JSON. Do not edit the contents.
-- This contains personal information. Keep it out of git and shared chats.
SELECT snapshot AS snapshot_json,
  (SELECT jsonb_object_agg(key, jsonb_array_length(value)) FROM jsonb_each(snapshot->'tables')) AS counts
FROM pg_temp.cutover_state;

