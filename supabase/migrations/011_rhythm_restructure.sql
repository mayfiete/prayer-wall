-- ============================================================
-- Rhythm Restructure: email_rhythms becomes a named template
-- library; commitment_rhythms links warriors to rhythms
-- ============================================================

-- Add a human-readable name to each rhythm template
ALTER TABLE prayer_wall.email_rhythms
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Prayer Rhythm';

-- Drop the wall-level uniqueness so multiple rhythms per wall are allowed
ALTER TABLE prayer_wall.email_rhythms
  DROP CONSTRAINT IF EXISTS email_rhythms_wall_id_key;

-- ============================================================
-- Junction table: which rhythms are assigned to which warrior
-- ============================================================
CREATE TABLE prayer_wall.commitment_rhythms (
  commitment_id UUID REFERENCES prayer_wall.commitments(id) ON DELETE CASCADE NOT NULL,
  rhythm_id     UUID REFERENCES prayer_wall.email_rhythms(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (commitment_id, rhythm_id)
);

CREATE INDEX ix_commitment_rhythms_commitment ON prayer_wall.commitment_rhythms(commitment_id);
CREATE INDEX ix_commitment_rhythms_rhythm     ON prayer_wall.commitment_rhythms(rhythm_id);

-- RLS
ALTER TABLE prayer_wall.commitment_rhythms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commitment_rhythms_admin_all"
  ON prayer_wall.commitment_rhythms FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON prayer_wall.commitment_rhythms TO anon;
GRANT INSERT, UPDATE, DELETE ON prayer_wall.commitment_rhythms TO authenticated;

-- Give authenticated full access to email_rhythms (was admin-only, still fine)
GRANT SELECT ON prayer_wall.email_rhythms TO anon;
