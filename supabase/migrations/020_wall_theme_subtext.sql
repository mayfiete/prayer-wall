-- ============================================================
-- Wall Theme: per-section subtext colors
-- Adds independent subtext (secondary text) colors for the
-- Header and Banner sections, so they no longer all share the
-- single global "muted" color.
-- Defaults match the previous global muted value (#88838a).
-- ============================================================

ALTER TABLE prayer_wall.wall_theme
  ADD COLUMN IF NOT EXISTS color_header_subtext TEXT NOT NULL DEFAULT '#88838a',
  ADD COLUMN IF NOT EXISTS color_banner_subtext TEXT NOT NULL DEFAULT '#88838a';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
