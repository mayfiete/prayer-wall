-- ============================================================
-- Prayer Statements — child of message_categories
-- ============================================================

CREATE TABLE prayer_wall.prayer_statements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID REFERENCES prayer_wall.message_categories(id) ON DELETE CASCADE NOT NULL,
  org_id       UUID REFERENCES prayer_wall.organizations(id) ON DELETE CASCADE NOT NULL,
  body         TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_prayer_statements_category ON prayer_wall.prayer_statements(category_id);
CREATE INDEX ix_prayer_statements_org      ON prayer_wall.prayer_statements(org_id);

-- RLS
ALTER TABLE prayer_wall.prayer_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "statements_public_read"
  ON prayer_wall.prayer_statements FOR SELECT
  USING (is_active = true);

CREATE POLICY "statements_admin_all"
  ON prayer_wall.prayer_statements FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Grants
GRANT SELECT ON prayer_wall.prayer_statements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON prayer_wall.prayer_statements TO authenticated;

-- Seed: sample statements for existing categories
-- (org_id = 00000000-0000-0000-0000-000000000001)
-- Categories must already exist; these reference them by name via subquery
INSERT INTO prayer_wall.prayer_statements (category_id, org_id, body, display_order)
SELECT id, org_id,
  '2 Corinthians 5:15 — "He died for all, that those who live might no longer live for themselves." Lord, bless every family represented on this wall and draw them closer to You.',
  1
FROM prayer_wall.message_categories
WHERE org_id = '00000000-0000-0000-0000-000000000001' AND name = 'Family';

INSERT INTO prayer_wall.prayer_statements (category_id, org_id, body, display_order)
SELECT id, org_id,
  'James 5:14-15 — "Is anyone among you sick? Let them call the elders of the church to pray over them." Father, we lift up every need for physical and emotional healing.',
  1
FROM prayer_wall.message_categories
WHERE org_id = '00000000-0000-0000-0000-000000000001' AND name = 'Health';
