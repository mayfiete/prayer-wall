-- ============================================================
-- Prayer Points: individual prayer items per commitment/warrior
-- ============================================================

CREATE TABLE prayer_wall.prayer_points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID REFERENCES prayer_wall.commitments(id) ON DELETE CASCADE NOT NULL,
  body          TEXT NOT NULL,
  is_answered   BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX prayer_points_commitment_id_idx ON prayer_wall.prayer_points(commitment_id);

-- RLS
ALTER TABLE prayer_wall.prayer_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prayer_points_public_read"
  ON prayer_wall.prayer_points FOR SELECT
  USING (true);

CREATE POLICY "prayer_points_admin_insert"
  ON prayer_wall.prayer_points FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "prayer_points_admin_update"
  ON prayer_wall.prayer_points FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "prayer_points_admin_delete"
  ON prayer_wall.prayer_points FOR DELETE
  TO authenticated
  USING (true);

GRANT SELECT ON prayer_wall.prayer_points TO anon;
GRANT INSERT, UPDATE, DELETE ON prayer_wall.prayer_points TO authenticated;
