-- ============================================================
-- 016_category_rhythms.sql
-- Links prayer categories to email rhythms so that all
-- bricklayers who subscribed to a category receive reminders
-- on that category's schedule, with stacked meditations when
-- they belong to multiple categories.
-- ============================================================

CREATE TABLE prayer_wall.category_rhythms (
  category_id UUID REFERENCES prayer_wall.message_categories(id) ON DELETE CASCADE NOT NULL,
  rhythm_id   UUID REFERENCES prayer_wall.email_rhythms(id)      ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (category_id, rhythm_id)
);

CREATE INDEX ix_category_rhythms_category ON prayer_wall.category_rhythms(category_id);
CREATE INDEX ix_category_rhythms_rhythm   ON prayer_wall.category_rhythms(rhythm_id);

-- RLS
ALTER TABLE prayer_wall.category_rhythms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_rhythms_admin_all"
  ON prayer_wall.category_rhythms FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON prayer_wall.category_rhythms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON prayer_wall.category_rhythms TO authenticated;
