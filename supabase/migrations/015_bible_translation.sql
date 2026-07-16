-- ============================================================
-- 015_bible_translation.sql
-- Adds bible_translation column to wall_theme so each wall
-- can choose which Bible translation to use in reminder emails.
-- Supported values: 'ESV' | 'NIV'
-- Default: 'ESV' (available via API.Bible, no AI/ML restriction)
-- ============================================================

ALTER TABLE prayer_wall.wall_theme
  ADD COLUMN IF NOT EXISTS bible_translation TEXT NOT NULL DEFAULT 'ESV';
