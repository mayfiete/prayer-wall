-- ============================================================
-- Wall Theme: store color, font, and title tokens per wall
-- ============================================================

CREATE TABLE public.wall_theme (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id     UUID NOT NULL UNIQUE,
  wall_title  TEXT NOT NULL DEFAULT 'Prayer Foundation',
  color_primary    TEXT NOT NULL DEFAULT '#5e061e',
  color_heading    TEXT NOT NULL DEFAULT '#242148',
  color_muted      TEXT NOT NULL DEFAULT '#88838a',
  color_background TEXT NOT NULL DEFAULT '#d7c39d',
  font_heading TEXT NOT NULL DEFAULT 'serif',
  font_body    TEXT NOT NULL DEFAULT 'sans-serif',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.wall_theme ENABLE ROW LEVEL SECURITY;

-- Public read: anyone loading the wall can fetch theme tokens
CREATE POLICY "wall_theme_public_read"
  ON public.wall_theme FOR SELECT
  USING (true);

-- Authenticated write: only admins can upsert
CREATE POLICY "wall_theme_admin_insert"
  ON public.wall_theme FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "wall_theme_admin_update"
  ON public.wall_theme FOR UPDATE
  TO authenticated
  USING (true);
