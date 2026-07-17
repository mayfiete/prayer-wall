-- ============================================================
-- 017_rhythm_end_date.sql
-- Adds an optional end_date to email_rhythms so a rhythm can
-- automatically stop firing after a specific date.
-- NULL = no end date (runs indefinitely).
-- ============================================================

ALTER TABLE prayer_wall.email_rhythms
  ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT NULL;
