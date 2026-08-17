-- ============================================================
-- Wall Theme: editable UI text strings
-- Adds columns for static text that previously was hardcoded,
-- so an admin (Ivy) can edit headings, prompts, and button
-- labels without a code deploy.
-- ============================================================

ALTER TABLE prayer_wall.wall_theme
  ADD COLUMN IF NOT EXISTS text_banner_heading  TEXT NOT NULL DEFAULT 'Add your name to the wall',
  ADD COLUMN IF NOT EXISTS text_banner_body     TEXT NOT NULL DEFAULT 'Commit to pray for one or more areas of need and place your stone on the foundation.',
  ADD COLUMN IF NOT EXISTS text_wall_cta        TEXT NOT NULL DEFAULT 'Click the next open stone to join!',
  ADD COLUMN IF NOT EXISTS text_modal_title     TEXT NOT NULL DEFAULT 'Commit to pray',
  ADD COLUMN IF NOT EXISTS text_success_heading TEXT NOT NULL DEFAULT 'Your stone has been placed!',
  ADD COLUMN IF NOT EXISTS text_success_body    TEXT NOT NULL DEFAULT 'You will receive weekly prayer reminders by email.',
  ADD COLUMN IF NOT EXISTS text_submit_button   TEXT NOT NULL DEFAULT 'Add my stone to the foundation!';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
