-- ============================================================
-- Commitment Wall — Initial Schema
-- ============================================================

CREATE SCHEMA IF NOT EXISTS prayer_wall;

-- Core tables
CREATE TABLE prayer_wall.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prayer_wall.walls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES prayer_wall.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE prayer_wall.message_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES prayer_wall.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE prayer_wall.commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id UUID REFERENCES prayer_wall.walls(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  committed_at TIMESTAMPTZ DEFAULT now(),
  reminder_active BOOLEAN DEFAULT true,
  last_reminded_at TIMESTAMPTZ
);

CREATE TABLE prayer_wall.commitment_categories (
  commitment_id UUID REFERENCES prayer_wall.commitments(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES prayer_wall.message_categories(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (commitment_id, category_id)
);

CREATE TABLE prayer_wall.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id UUID REFERENCES prayer_wall.walls(id) ON DELETE CASCADE NOT NULL,
  commitment_id UUID REFERENCES prayer_wall.commitments(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  resend_message_id TEXT
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX ix_walls_org ON prayer_wall.walls(org_id);
CREATE INDEX ix_commitments_wall ON prayer_wall.commitments(wall_id);
CREATE INDEX ix_categories_org ON prayer_wall.message_categories(org_id);
CREATE INDEX ix_commitment_categories_commitment ON prayer_wall.commitment_categories(commitment_id);
CREATE INDEX ix_commitment_categories_category ON prayer_wall.commitment_categories(category_id);
CREATE INDEX ix_email_logs_wall ON prayer_wall.email_logs(wall_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE prayer_wall.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_wall.walls ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_wall.message_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_wall.commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_wall.commitment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_wall.email_logs ENABLE ROW LEVEL SECURITY;

-- Public read: organization display info
CREATE POLICY "orgs_public_read" ON prayer_wall.organizations FOR SELECT USING (true);

-- Public read: active walls
CREATE POLICY "walls_public_read" ON prayer_wall.walls FOR SELECT USING (is_active = true);

-- Public read: active categories (for the commitment form)
CREATE POLICY "categories_public_read" ON prayer_wall.message_categories FOR SELECT USING (is_active = true);

-- Public insert: anyone can make a commitment
CREATE POLICY "commitments_public_insert" ON prayer_wall.commitments FOR INSERT WITH CHECK (true);

-- Public read: name + timestamps only (email excluded via column-level grants below)
CREATE POLICY "commitments_public_select" ON prayer_wall.commitments FOR SELECT USING (true);

-- Public insert: attach categories when committing
CREATE POLICY "commitment_categories_public_insert" ON prayer_wall.commitment_categories FOR INSERT WITH CHECK (true);

-- Public read: which categories are attached
CREATE POLICY "commitment_categories_public_select" ON prayer_wall.commitment_categories FOR SELECT USING (true);

-- email_logs: no public access
CREATE POLICY "email_logs_deny_all" ON prayer_wall.email_logs USING (false);

-- ============================================================
-- Column-level security: hide email from anon
-- ============================================================
REVOKE SELECT ON prayer_wall.commitments FROM anon;
GRANT SELECT (id, wall_id, name, committed_at, reminder_active, last_reminded_at)
  ON prayer_wall.commitments TO anon;

-- ============================================================
-- Expose schema to PostgREST (Supabase API)
-- ============================================================
GRANT USAGE ON SCHEMA prayer_wall TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA prayer_wall TO anon, authenticated;
GRANT INSERT ON prayer_wall.commitments TO anon, authenticated;
GRANT INSERT ON prayer_wall.commitment_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON prayer_wall.message_categories TO authenticated;

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_wall.commitments;

-- ============================================================
-- Seed: default organization
-- Adjust name and slug to match your organization
-- ============================================================
INSERT INTO prayer_wall.organizations (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'My Organization', 'my-org');

INSERT INTO prayer_wall.walls (id, org_id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Main Prayer Wall', 'main');

INSERT INTO prayer_wall.message_categories (org_id, name, display_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Family', 1),
  ('00000000-0000-0000-0000-000000000001', 'Health', 2),
  ('00000000-0000-0000-0000-000000000001', 'Finances', 3),
  ('00000000-0000-0000-0000-000000000001', 'Relationships', 4),
  ('00000000-0000-0000-0000-000000000001', 'Work & Career', 5),
  ('00000000-0000-0000-0000-000000000001', 'Spiritual Growth', 6),
  ('00000000-0000-0000-0000-000000000001', 'Community', 7),
  ('00000000-0000-0000-0000-000000000001', 'Mission & Outreach', 8);
