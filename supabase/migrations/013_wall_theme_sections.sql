-- ============================================================
-- Wall Theme: per-section background colors and fonts
-- Adds controls for Header, Banner, and Wall sections
-- independently of the global colors/fonts.
-- ============================================================

ALTER TABLE prayer_wall.wall_theme
  ADD COLUMN IF NOT EXISTS color_header_bg   TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS color_header_text TEXT NOT NULL DEFAULT '#242148',
  ADD COLUMN IF NOT EXISTS font_header       TEXT NOT NULL DEFAULT 'serif',

  ADD COLUMN IF NOT EXISTS color_banner_bg   TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS color_banner_text TEXT NOT NULL DEFAULT '#342f31',
  ADD COLUMN IF NOT EXISTS font_banner       TEXT NOT NULL DEFAULT 'sans-serif',

  ADD COLUMN IF NOT EXISTS color_wall_bg     TEXT NOT NULL DEFAULT '#d7c39d',
  ADD COLUMN IF NOT EXISTS color_wall_text   TEXT NOT NULL DEFAULT '#342f31',
  ADD COLUMN IF NOT EXISTS font_wall         TEXT NOT NULL DEFAULT 'sans-serif',

  ADD COLUMN IF NOT EXISTS color_modal_bg     TEXT NOT NULL DEFAULT '#1c1917',
  ADD COLUMN IF NOT EXISTS color_modal_text   TEXT NOT NULL DEFAULT '#f5f5f4',
  ADD COLUMN IF NOT EXISTS color_modal_accent TEXT NOT NULL DEFAULT '#d97706',
  ADD COLUMN IF NOT EXISTS font_modal         TEXT NOT NULL DEFAULT 'sans-serif';
