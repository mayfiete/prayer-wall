-- ============================================================
-- Prayer Wall — Initial Schema
-- ============================================================

-- Core tables
CREATE TABLE churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prayer_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE prayer_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  committed_at TIMESTAMPTZ DEFAULT now(),
  reminder_active BOOLEAN DEFAULT true,
  last_reminded_at TIMESTAMPTZ
);

CREATE TABLE prayer_commitment_categories (
  commitment_id UUID REFERENCES prayer_commitments(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES prayer_categories(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (commitment_id, category_id)
);

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  commitment_id UUID REFERENCES prayer_commitments(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ DEFAULT now(),
  resend_message_id TEXT
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX ix_commitments_church ON prayer_commitments(church_id);
CREATE INDEX ix_categories_church ON prayer_categories(church_id);
CREATE INDEX ix_commitment_categories_commitment ON prayer_commitment_categories(commitment_id);
CREATE INDEX ix_commitment_categories_category ON prayer_commitment_categories(category_id);
CREATE INDEX ix_email_logs_church ON email_logs(church_id);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_commitment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Public read: church display info
CREATE POLICY "churches_public_read" ON churches FOR SELECT USING (true);

-- Public read: active categories (for the commitment form)
CREATE POLICY "categories_public_read" ON prayer_categories FOR SELECT USING (is_active = true);

-- Public insert: anyone can make a prayer commitment
CREATE POLICY "commitments_public_insert" ON prayer_commitments FOR INSERT WITH CHECK (true);

-- Public read: name + timestamps only (email excluded via column-level grants below)
CREATE POLICY "commitments_public_select" ON prayer_commitments FOR SELECT USING (true);

-- Public insert: attach categories when committing
CREATE POLICY "commitment_categories_public_insert" ON prayer_commitment_categories FOR INSERT WITH CHECK (true);

-- Public read: which categories are attached
CREATE POLICY "commitment_categories_public_select" ON prayer_commitment_categories FOR SELECT USING (true);

-- email_logs: no public access
CREATE POLICY "email_logs_deny_all" ON email_logs USING (false);

-- ============================================================
-- Column-level security: hide email from anon
-- ============================================================
REVOKE SELECT ON prayer_commitments FROM anon;
GRANT SELECT (id, church_id, name, committed_at, reminder_active, last_reminded_at)
  ON prayer_commitments TO anon;

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_commitments;

-- ============================================================
-- Seed: default church
-- Adjust name and slug to match your church
-- ============================================================
INSERT INTO churches (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'My Church', 'my-church');

INSERT INTO prayer_categories (church_id, name, display_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Family', 1),
  ('00000000-0000-0000-0000-000000000001', 'Health', 2),
  ('00000000-0000-0000-0000-000000000001', 'Finances', 3),
  ('00000000-0000-0000-0000-000000000001', 'Relationships', 4),
  ('00000000-0000-0000-0000-000000000001', 'Work & Career', 5),
  ('00000000-0000-0000-0000-000000000001', 'Spiritual Growth', 6),
  ('00000000-0000-0000-0000-000000000001', 'Community', 7),
  ('00000000-0000-0000-0000-000000000001', 'Mission & Outreach', 8);
