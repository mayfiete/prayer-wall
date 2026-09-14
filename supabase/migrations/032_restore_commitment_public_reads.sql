-- Run after migration 031 in the Supabase SQL Editor.
-- The original 031 revoked SELECT without restoring the public column grants.
-- Restore only the columns used by the public prayer wall and INSERT RETURNING.
BEGIN;

REVOKE SELECT ON prayer_wall.commitments FROM PUBLIC, anon;
GRANT SELECT (id, wall_id, name, committed_at, reminder_active, last_reminded_at)
  ON prayer_wall.commitments TO anon;

-- Email, first_name, last_name, and full_name remain unavailable to anon.
-- Authenticated admin and service_role permissions are unchanged.
NOTIFY pgrst, 'reload schema';
COMMIT;
