-- ============================================================
-- 034_email_copy.sql
-- Admin-editable wording for every outgoing email.
--
-- One row per (wall_id, copy_key). Keys and their defaults live in
-- supabase/functions/_shared/email-copy.ts; only overrides are stored here,
-- so a missing row simply means "use the shipped default".
--
-- Values are plain text. Edge functions HTML-escape them at render time, so
-- an admin account cannot inject markup or scripts into an email.
--
-- wall_id intentionally has no FK: it points at prayer_wall.walls for the
-- prayer wall and prayer_wall.giving_walls for the giving wall, exactly like
-- wall_theme after migration 025.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS prayer_wall.email_copy (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id    uuid NOT NULL,
  copy_key   text NOT NULL CHECK (copy_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  value      text NOT NULL CHECK (char_length(value) <= 5000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wall_id, copy_key)
);

CREATE INDEX IF NOT EXISTS email_copy_wall_id_idx
  ON prayer_wall.email_copy (wall_id);

DROP TRIGGER IF EXISTS email_copy_updated_at ON prayer_wall.email_copy;
CREATE TRIGGER email_copy_updated_at
  BEFORE UPDATE ON prayer_wall.email_copy
  FOR EACH ROW EXECUTE FUNCTION prayer_wall.set_updated_at();

ALTER TABLE prayer_wall.email_copy ENABLE ROW LEVEL SECURITY;

-- Email wording is never needed by the public wall, so anon gets no access.
REVOKE ALL ON prayer_wall.email_copy FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON prayer_wall.email_copy TO authenticated;
GRANT ALL ON prayer_wall.email_copy TO service_role;

DROP POLICY IF EXISTS "email_copy_admin_read"   ON prayer_wall.email_copy;
DROP POLICY IF EXISTS "email_copy_admin_insert" ON prayer_wall.email_copy;
DROP POLICY IF EXISTS "email_copy_admin_update" ON prayer_wall.email_copy;
DROP POLICY IF EXISTS "email_copy_admin_delete" ON prayer_wall.email_copy;

-- Same trust model as wall_theme: a signed-in Supabase user is an admin.
CREATE POLICY "email_copy_admin_read"
  ON prayer_wall.email_copy FOR SELECT TO authenticated USING (true);
CREATE POLICY "email_copy_admin_insert"
  ON prayer_wall.email_copy FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "email_copy_admin_update"
  ON prayer_wall.email_copy FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "email_copy_admin_delete"
  ON prayer_wall.email_copy FOR DELETE TO authenticated USING (true);

COMMIT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
