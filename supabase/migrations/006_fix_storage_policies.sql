-- ============================================================
-- Fix storage RLS policies for wall-assets bucket
-- Drop and recreate to ensure correct definitions
-- ============================================================

-- Ensure bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wall-assets',
  'wall-assets',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "wall_assets_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "wall_assets_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "wall_assets_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "wall_assets_public_select" ON storage.objects;

-- Authenticated users (admins) can upload new objects
CREATE POLICY "wall_assets_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'wall-assets');

-- Authenticated users can update (overwrite) objects
CREATE POLICY "wall_assets_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'wall-assets')
  WITH CHECK (bucket_id = 'wall-assets');

-- Authenticated users can delete objects
CREATE POLICY "wall_assets_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'wall-assets');

-- Public (anon) can read all objects in the bucket
CREATE POLICY "wall_assets_public_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'wall-assets');
