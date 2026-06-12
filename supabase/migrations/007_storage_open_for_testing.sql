-- ============================================================
-- TEMPORARY: Open storage policies for upload testing
-- Run 008_storage_restore_policies.sql to restore security
-- ============================================================

DROP POLICY IF EXISTS "wall_assets_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "wall_assets_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "wall_assets_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "wall_assets_public_select" ON storage.objects;

-- Allow ANY authenticated user to do anything in wall-assets
CREATE POLICY "wall_assets_open_authenticated"
  ON storage.objects
  TO authenticated
  USING (bucket_id = 'wall-assets')
  WITH CHECK (bucket_id = 'wall-assets');

-- Allow public read
CREATE POLICY "wall_assets_public_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'wall-assets');
