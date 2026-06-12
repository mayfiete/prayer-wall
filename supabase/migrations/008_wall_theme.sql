-- ============================================================
-- Wall Theme: store color, font, and title tokens per wall
-- ============================================================

CREATE TABLE prayer_wall.wall_theme (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id     UUID REFERENCES prayer_wall.walls(id) ON DELETE CASCADE NOT NULL UNIQUE,
  wall_title  TEXT NOT NULL DEFAULT 'Prayer Foundation',
  color_primary    TEXT NOT NULL DEFAULT '#5e061e',
  color_heading    TEXT NOT NULL DEFAULT '#242148',
  color_muted      TEXT NOT NULL DEFAULT '#88838a',
  color_background TEXT NOT NULL DEFAULT '#d7c39d',
  font_heading TEXT NOT NULL DEFAULT 'serif',
  font_body    TEXT NOT NULL DEFAULT 'sans-serif',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Trigger to keep updated_at current
CREATE TRIGGER wall_theme_updated_at
  BEFORE UPDATE ON prayer_wall.wall_theme
  FOR EACH ROW EXECUTE FUNCTION prayer_wall.set_updated_at();

-- RLS
ALTER TABLE prayer_wall.wall_theme ENABLE ROW LEVEL SECURITY;

-- Public read: anyone loading the wall can fetch theme tokens
CREATE POLICY "wall_theme_public_read"
  ON prayer_wall.wall_theme FOR SELECT
  USING (true);

-- Authenticated write: only admins can upsert
CREATE POLICY "wall_theme_admin_insert"
  ON prayer_wall.wall_theme FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "wall_theme_admin_update"
  ON prayer_wall.wall_theme FOR UPDATE
  TO authenticated
  USING (true);
