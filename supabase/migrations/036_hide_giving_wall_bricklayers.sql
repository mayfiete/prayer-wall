-- Requires migration 035. Preserve payment history and webhook idempotency.
BEGIN;
ALTER TABLE prayer_wall.donations
  ADD COLUMN IF NOT EXISTS hidden_from_wall boolean NOT NULL DEFAULT false;

-- Restrictive policy also guards against older permissive read policies.
CREATE POLICY donations_visible_only ON prayer_wall.donations
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (NOT hidden_from_wall);

CREATE OR REPLACE FUNCTION prayer_wall.admin_hide_donation(p_wall_id uuid, p_donation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT prayer_wall.is_app_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  UPDATE prayer_wall.donations SET hidden_from_wall = true
    WHERE id = p_donation_id AND giving_wall_id = p_wall_id;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION prayer_wall.admin_hide_donation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prayer_wall.admin_hide_donation(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
