-- ============================================================
-- Prayer Warriors: add prayer_request column to commitments
-- Warriors tab shows all commitments; prayer_request is editable by admin
-- ============================================================

ALTER TABLE prayer_wall.commitments
  ADD COLUMN IF NOT EXISTS prayer_request TEXT NOT NULL DEFAULT '';

-- Allow authenticated users to update commitments (for admin edits)
CREATE POLICY "commitments_admin_update"
  ON prayer_wall.commitments FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete commitments (for admin removal)
CREATE POLICY "commitments_admin_delete"
  ON prayer_wall.commitments FOR DELETE
  TO authenticated
  USING (true);

-- Grant authenticated full column access (anon already restricted above)
GRANT SELECT, UPDATE, DELETE ON prayer_wall.commitments TO authenticated;
