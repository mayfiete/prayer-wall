-- Run only this file against the current app schema in the Supabase SQL Editor.
-- Do not replay every historical migration: 027 does not apply to unified walls.
-- The two approved Auth UUIDs are the database's administrator allowlist.
BEGIN;

DO $$
DECLARE required_relation text;
BEGIN
  FOREACH required_relation IN ARRAY ARRAY[
    'prayer_wall.commitments', 'prayer_wall.donations',
    'prayer_wall.message_categories', 'prayer_wall.prayer_meditations',
    'prayer_wall.wall_theme', 'prayer_wall.email_rhythms',
    'prayer_wall.commitment_rhythms', 'prayer_wall.category_rhythms',
    'prayer_wall.prayer_points', 'prayer_wall.email_copy',
    'prayer_wall.commitment_categories', 'prayer_wall.email_logs',
    'prayer_wall.webhook_events', 'storage.objects'
  ] LOOP
    IF to_regclass(required_relation) IS NULL THEN
      RAISE EXCEPTION 'Required table % is missing; verify this project has the current app schema before applying migration 035', required_relation;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM auth.users WHERE id IN (
    '5356e9c6-47c3-467f-82d3-81b6da9c0323'::uuid,
    '1c9a97ce-20be-446b-8fe6-ac877f0adda0'::uuid
  )) <> 2 THEN
    RAISE EXCEPTION 'Both approved Auth users must exist in this project before applying migration 035';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION prayer_wall.is_app_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(auth.uid() = ANY (ARRAY[
    '5356e9c6-47c3-467f-82d3-81b6da9c0323'::uuid,
    '1c9a97ce-20be-446b-8fe6-ac877f0adda0'::uuid
  ]), false);
$$;
REVOKE ALL ON FUNCTION prayer_wall.is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prayer_wall.is_app_admin() TO anon, authenticated, service_role;

-- Both public pages load shared branding without requiring a login.
-- Historical migration 008 defines RLS but omits this explicit table grant.
GRANT SELECT ON prayer_wall.wall_theme TO anon, authenticated;

-- Both browser roles receive the same public projection, never full rows.
REVOKE SELECT ON prayer_wall.commitments FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, wall_id, name, committed_at, reminder_active, last_reminded_at)
  ON prayer_wall.commitments TO anon, authenticated;
REVOKE SELECT ON prayer_wall.donations FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, giving_wall_id, name, amount_cents, currency, processor,
  processor_ref, email_opt_out, donated_at, created_at)
  ON prayer_wall.donations TO anon, authenticated;

-- SECURITY DEFINER is limited to read-only, fixed-table queries and checks the
-- caller's JWT-derived UUID before any private data is read. No dynamic SQL.
CREATE OR REPLACE FUNCTION prayer_wall.admin_read_commitments(p_wall_id uuid)
RETURNS SETOF prayer_wall.commitments
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT prayer_wall.is_app_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT c.* FROM prayer_wall.commitments c
    WHERE c.wall_id = p_wall_id ORDER BY c.committed_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION prayer_wall.admin_read_commitments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prayer_wall.admin_read_commitments(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION prayer_wall.admin_read_donations(p_wall_id uuid)
RETURNS SETOF prayer_wall.donations
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT prayer_wall.is_app_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT d.* FROM prayer_wall.donations d
    WHERE d.giving_wall_id = p_wall_id ORDER BY d.donated_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION prayer_wall.admin_read_donations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION prayer_wall.admin_read_donations(uuid) TO authenticated;

-- Restrictive policies AND with existing permissive policies, including broad
-- legacy policies. Preserve public commitment creation and category attachment.
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['message_categories', 'prayer_meditations',
    'wall_theme', 'email_rhythms', 'commitment_rhythms', 'category_rhythms',
    'prayer_points', 'email_copy', 'commitments', 'commitment_categories'] LOOP
    EXECUTE format('ALTER TABLE prayer_wall.%I ENABLE ROW LEVEL SECURITY', target);
    EXECUTE format('DROP POLICY IF EXISTS allowlisted_admin_access ON prayer_wall.%I', target);
    EXECUTE format('CREATE POLICY allowlisted_admin_access ON prayer_wall.%I FOR ALL TO authenticated USING (prayer_wall.is_app_admin()) WITH CHECK (prayer_wall.is_app_admin())', target);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON prayer_wall.%I TO authenticated', target);
    IF target <> 'commitments' THEN
      EXECUTE format('GRANT SELECT ON prayer_wall.%I TO authenticated', target);
    END IF;
    IF target NOT IN ('commitments', 'commitment_categories') THEN
      EXECUTE format('DROP POLICY IF EXISTS restrict_admin_insert ON prayer_wall.%I', target);
      EXECUTE format('CREATE POLICY restrict_admin_insert ON prayer_wall.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (prayer_wall.is_app_admin())', target);
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS restrict_admin_update ON prayer_wall.%I', target);
    EXECUTE format('CREATE POLICY restrict_admin_update ON prayer_wall.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (prayer_wall.is_app_admin()) WITH CHECK (prayer_wall.is_app_admin())', target);
    EXECUTE format('DROP POLICY IF EXISTS restrict_admin_delete ON prayer_wall.%I', target);
    EXECUTE format('CREATE POLICY restrict_admin_delete ON prayer_wall.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (prayer_wall.is_app_admin())', target);
  END LOOP;

  -- Individual requests, email schedules/copy and raw audit logs are private.
  FOREACH target IN ARRAY ARRAY['prayer_points', 'commitment_categories',
    'email_rhythms', 'commitment_rhythms', 'category_rhythms', 'email_copy',
    'email_logs', 'webhook_events'] LOOP
    EXECUTE format('REVOKE SELECT ON prayer_wall.%I FROM PUBLIC, anon', target);
    EXECUTE format('GRANT SELECT ON prayer_wall.%I TO authenticated', target);
    EXECUTE format('DROP POLICY IF EXISTS allowlisted_admin_read ON prayer_wall.%I', target);
    EXECUTE format('CREATE POLICY allowlisted_admin_read ON prayer_wall.%I FOR SELECT TO authenticated USING (prayer_wall.is_app_admin())', target);
    EXECUTE format('DROP POLICY IF EXISTS restrict_admin_read ON prayer_wall.%I', target);
    EXECUTE format('CREATE POLICY restrict_admin_read ON prayer_wall.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (prayer_wall.is_app_admin())', target);
  END LOOP;

  -- Existing FOR ALL policies must not expose inactive display content to
  -- ordinary signed-in users. Approved admins can still manage inactive rows.
  FOREACH target IN ARRAY ARRAY['message_categories', 'prayer_meditations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS restrict_inactive_read ON prayer_wall.%I', target);
    EXECUTE format('CREATE POLICY restrict_inactive_read ON prayer_wall.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (is_active OR prayer_wall.is_app_admin())', target);
  END LOOP;
END;
$$;

-- Guard both asset bucket names used by this repository and email branding.
-- Other buckets keep their existing policies. Public image reads are unchanged.
DROP POLICY IF EXISTS allowlisted_wall_assets ON storage.objects;
CREATE POLICY allowlisted_wall_assets ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('wall-assets', 'prayer-wall-images', 'email-assets') AND prayer_wall.is_app_admin())
  WITH CHECK (bucket_id IN ('wall-assets', 'prayer-wall-images', 'email-assets') AND prayer_wall.is_app_admin());
DROP POLICY IF EXISTS restrict_wall_assets_insert ON storage.objects;
CREATE POLICY restrict_wall_assets_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id NOT IN ('wall-assets', 'prayer-wall-images', 'email-assets') OR prayer_wall.is_app_admin());
DROP POLICY IF EXISTS restrict_wall_assets_update ON storage.objects;
CREATE POLICY restrict_wall_assets_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id NOT IN ('wall-assets', 'prayer-wall-images', 'email-assets') OR prayer_wall.is_app_admin())
  WITH CHECK (bucket_id NOT IN ('wall-assets', 'prayer-wall-images', 'email-assets') OR prayer_wall.is_app_admin());
DROP POLICY IF EXISTS restrict_wall_assets_delete ON storage.objects;
CREATE POLICY restrict_wall_assets_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id NOT IN ('wall-assets', 'prayer-wall-images', 'email-assets') OR prayer_wall.is_app_admin());

NOTIFY pgrst, 'reload schema';
COMMIT;
