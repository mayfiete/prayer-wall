-- Migration 029: adopt the unified walls table (FE-001, phase 1 — additive only)
--
-- Context. docs/future_enhancements/001-unified-walls-table.md proposes merging
-- prayer_wall.giving_walls into prayer_wall.walls behind an app_type
-- discriminator. On this database that merge has already happened by accident:
-- migration 023 was never run, giving_walls does not exist, and the giving wall
-- is a row in walls (25bc7657-…, slug 'giving'). Verified 2026-09-08.
--
-- This migration records that reality in the schema. It is deliberately
-- ADDITIVE ONLY — nothing is dropped, deleted, or repointed:
--
--   ✓ adds walls.app_type, defaulting to 'prayer' so every existing row keeps
--     its current meaning
--   ✓ tags the giving wall (matched by slug, not a hard-coded UUID)
--   ✓ reports the orphaned wall_theme row it found, without touching it
--
--   ✗ does NOT delete the orphaned wall_theme row (see section 4)
--   ✗ does NOT restore wall_theme_wall_id_fkey (blocked by that orphan)
--   ✗ does NOT drop giving_walls (it does not exist here)
--
-- Safe to re-run. Rollback is a single statement:
--   ALTER TABLE prayer_wall.walls DROP COLUMN app_type;
--
-- Nothing in src/ selects from walls, and GRANT SELECT in migration 001 is
-- table-level, so the new column needs no grant and breaks no query.

-- ── 1. Guard: this file assumes the unified-walls world ───────────────────────
DO $$
BEGIN
  IF to_regclass('prayer_wall.giving_walls') IS NOT NULL THEN
    RAISE EXCEPTION
      'prayer_wall.giving_walls exists on this database, so the unified-walls assumption behind this migration does not hold. Decide the direction first — see docs/future_enhancements/001-unified-walls-table.md — and migrate the giving_walls rows into walls before running this.';
  END IF;
END $$;

-- ── 2. Add the discriminator ──────────────────────────────────────────────────
-- DEFAULT 'prayer' is the whole safety story: every existing row, and every
-- INSERT written before this migration, keeps working unchanged.
ALTER TABLE prayer_wall.walls
  ADD COLUMN IF NOT EXISTS app_type text NOT NULL DEFAULT 'prayer';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'walls_app_type_check'
  ) THEN
    ALTER TABLE prayer_wall.walls
      ADD CONSTRAINT walls_app_type_check CHECK (app_type IN ('prayer', 'giving'));
  END IF;
END $$;

-- ── 3. Tag the giving wall ────────────────────────────────────────────────────
-- Matched on slug so this is portable across environments. If your giving wall
-- uses a different slug, adjust it here rather than hard-coding a UUID.
DO $$
DECLARE
  tagged int;
BEGIN
  UPDATE prayer_wall.walls SET app_type = 'giving' WHERE slug = 'giving';
  GET DIAGNOSTICS tagged = ROW_COUNT;

  IF tagged = 0 THEN
    RAISE WARNING 'No wall with slug ''giving'' was found — every wall remains app_type = ''prayer''. Tag the giving wall manually if its slug differs.';
  ELSE
    RAISE NOTICE 'Tagged % wall(s) as app_type = ''giving''.', tagged;
  END IF;
END $$;

-- ── 4. Report orphaned wall_theme rows — DOES NOT DELETE ──────────────────────
-- Migration 025 dropped wall_theme_wall_id_fkey, citing a giving_walls table
-- that never existed here. The real obstacle to restoring that FK is wall_theme
-- rows whose wall_id matches no wall — e.g. 00000000-0000-0000-0000-000000000003,
-- the placeholder VITE_GIVING_WALL_ID from .env.example.
--
-- Deleting theme rows is destructive and out of scope for this migration, so we
-- only report. Restoring the FK is phase 2, once you have confirmed each orphan
-- is genuinely unused:
--
--   SELECT t.wall_id FROM prayer_wall.wall_theme t
--    WHERE NOT EXISTS (SELECT 1 FROM prayer_wall.walls w WHERE w.id = t.wall_id);
--
--   -- then, only after reviewing that list:
--   -- DELETE FROM prayer_wall.wall_theme WHERE wall_id IN (...);
--   -- ALTER TABLE prayer_wall.wall_theme
--   --   ADD CONSTRAINT wall_theme_wall_id_fkey
--   --   FOREIGN KEY (wall_id) REFERENCES prayer_wall.walls(id) ON DELETE CASCADE;
DO $$
DECLARE
  orphans int;
BEGIN
  SELECT count(*) INTO orphans
    FROM prayer_wall.wall_theme t
   WHERE NOT EXISTS (SELECT 1 FROM prayer_wall.walls w WHERE w.id = t.wall_id);

  IF orphans > 0 THEN
    RAISE NOTICE
      '% orphaned wall_theme row(s) found. wall_theme_wall_id_fkey cannot be restored until these are resolved — see section 4. Nothing was deleted.',
      orphans;
  ELSE
    RAISE NOTICE 'No orphaned wall_theme rows — the FK dropped in migration 025 could now be restored (phase 2).';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── 5. Verify ─────────────────────────────────────────────────────────────────
-- Expect one 'prayer' row and one 'giving' row:
--
--   SELECT id, name, slug, app_type FROM prayer_wall.walls ORDER BY app_type;
