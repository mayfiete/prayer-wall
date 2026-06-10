-- ============================================================
-- Storage: create wall-assets bucket for stone texture uploads
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wall-assets',
  'wall-assets',
  true,
  15728640,  -- 15 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users (admins) to upload / overwrite
CREATE POLICY "wall_assets_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'wall-assets');

CREATE POLICY "wall_assets_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'wall-assets');

CREATE POLICY "wall_assets_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'wall-assets');

-- Allow public read (bucket is public, but explicit policy for clarity)
CREATE POLICY "wall_assets_public_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'wall-assets');
