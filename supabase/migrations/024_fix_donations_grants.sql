-- Migration 024: Fix donations table grants
-- Migration 022 used REVOKE SELECT + column-level GRANT, but Postgres requires
-- table-level SELECT for PostgREST to reach the table at all — column-level
-- GRANTs don't substitute for it. The result was "permission denied for table
-- donations" before RLS could fire.
--
-- Correct pattern: GRANT table-level SELECT, then REVOKE just the email column.

-- Undo the broken column-level-only grants from 022
REVOKE SELECT ON prayer_wall.donations FROM anon, authenticated;

-- Grant table-level SELECT so PostgREST / RLS can operate
GRANT SELECT ON prayer_wall.donations TO anon, authenticated;

-- Strip email column from anon/authenticated reads
REVOKE SELECT (email) ON prayer_wall.donations FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
