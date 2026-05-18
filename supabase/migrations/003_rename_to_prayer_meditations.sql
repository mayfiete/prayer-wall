-- ============================================================
-- Rename prayer_statements → prayer_meditations
-- ============================================================

ALTER TABLE prayer_wall.prayer_statements
  RENAME TO prayer_meditations;

ALTER INDEX prayer_wall.ix_prayer_statements_category
  RENAME TO ix_prayer_meditations_category;

ALTER INDEX prayer_wall.ix_prayer_statements_org
  RENAME TO ix_prayer_meditations_org;

DROP POLICY IF EXISTS "statements_public_read" ON prayer_wall.prayer_meditations;
DROP POLICY IF EXISTS "statements_admin_all"   ON prayer_wall.prayer_meditations;

CREATE POLICY "meditations_public_read"
  ON prayer_wall.prayer_meditations FOR SELECT
  USING (is_active = true);

CREATE POLICY "meditations_admin_all"
  ON prayer_wall.prayer_meditations FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
