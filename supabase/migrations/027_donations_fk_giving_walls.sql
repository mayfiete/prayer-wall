-- Migration 027: point donations.giving_wall_id at prayer_wall.giving_walls
--
-- ⚠️  DO NOT RUN THIS ON THE CURRENT DATABASE. It is not needed, and it will
--     fail. Verified 2026-09-08 against project swrcawckpsotialqnisq:
--
--       prayer_wall.giving_walls          does not exist (migration 023 was never run)
--       donations_giving_wall_id_fkey     already points at prayer_wall.walls
--       VITE_GIVING_WALL_ID 25bc7657-…    is a row in prayer_wall.walls ("Giving Wall")
--
--     The FK is therefore already satisfied and the webhook insert works as-is.
--
-- The original header said to run this when the migration 026 diagnostic reports
-- fk_points_at = prayer_wall.walls. That instruction was inverted: fk_points_at
-- = walls plus the id being present in walls is precisely the healthy state.
-- Running it produced only:
--
--   ERROR: relation "prayer_wall.giving_walls" does not exist
--
-- This file is kept, rather than deleted, for the one case where it applies:
-- a deployment that DID run migration 023 and keeps giving walls in their own
-- table. The guard below makes that explicit instead of failing obscurely.
--
-- If you are deciding which table giving walls should live in, read
-- docs/future_enhancements/001-unified-walls-table.md first — this database has
-- effectively already adopted the unified-walls approach by accident.

-- ── 0. Refuse to run unless giving_walls actually exists ──────────────────────
DO $$
BEGIN
  IF to_regclass('prayer_wall.giving_walls') IS NULL THEN
    RAISE EXCEPTION
      'prayer_wall.giving_walls does not exist, so this migration does not apply. The donations FK already points at prayer_wall.walls, which is correct for this deployment — see the header. Do nothing.';
  END IF;
END $$;

-- ── 1. Refuse to run if existing rows would be orphaned ───────────────────────
DO $$
DECLARE
  orphans int;
BEGIN
  SELECT count(*) INTO orphans
    FROM prayer_wall.donations d
   WHERE NOT EXISTS (
     SELECT 1 FROM prayer_wall.giving_walls g WHERE g.id = d.giving_wall_id
   );

  IF orphans > 0 THEN
    RAISE EXCEPTION
      '% donation row(s) reference a giving_wall_id missing from prayer_wall.giving_walls. Insert the wall row(s) there first, or repoint those donations, then re-run.',
      orphans;
  END IF;
END $$;

-- ── 2. Repoint the constraint ─────────────────────────────────────────────────
-- NOTE: run sections 0-2 as a single batch. Executed statement-by-statement, the
-- DROP below can succeed while the ADD fails, leaving donations with no FK.
ALTER TABLE prayer_wall.donations
  DROP CONSTRAINT IF EXISTS donations_giving_wall_id_fkey;

ALTER TABLE prayer_wall.donations
  ADD CONSTRAINT donations_giving_wall_id_fkey
    FOREIGN KEY (giving_wall_id)
    REFERENCES prayer_wall.giving_walls(id)
    ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
-- Expect fk_points_at = prayer_wall.giving_walls, and in_giving_walls = true
-- for the UUID in VITE_GIVING_WALL_ID / the GIVING_WALL_ID edge secret.
--
-- SELECT
--   (SELECT confrelid::regclass::text
--      FROM pg_constraint
--     WHERE conname = 'donations_giving_wall_id_fkey')                     AS fk_points_at,
--   (SELECT count(*) FROM prayer_wall.giving_walls
--     WHERE id = '<VITE_GIVING_WALL_ID>') > 0                              AS in_giving_walls;
