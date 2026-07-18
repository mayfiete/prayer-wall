-- ============================================================
-- 018_email_logs_type.sql
-- Adds email_type column to prayer_wall.email_logs so that
-- confirmation and summary emails sent at commitment time are
-- distinguishable from scheduled reminder emails.
--
-- Existing rows and future send-reminders inserts default to
-- 'reminder' so no code changes are needed in that function.
-- ============================================================

ALTER TABLE prayer_wall.email_logs
  ADD COLUMN IF NOT EXISTS email_type TEXT NOT NULL DEFAULT 'reminder'
    CHECK (email_type IN ('reminder', 'confirmation', 'summary'));
