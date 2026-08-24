-- 023_giving_walls_table.sql
-- Adds a giving_walls lookup table (parallel to walls) so the giving wall
-- can have its own wall_theme row and be referenced by VITE_GIVING_WALL_ID.

CREATE TABLE IF NOT EXISTS prayer_wall.giving_walls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES prayer_wall.organizations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prayer_wall.giving_walls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "giving_walls: public read"
  ON prayer_wall.giving_walls FOR SELECT USING (true);

GRANT SELECT ON prayer_wall.giving_walls TO anon, authenticated;
GRANT ALL    ON prayer_wall.giving_walls TO service_role;

-- wall_theme already references wall_id as text, so no FK needed.
-- Insert a seed wall_theme row for the giving wall if VITE_GIVING_WALL_ID
-- is known at migration time — otherwise insert via the /giving/admin Theme tab.

-- After running this migration:
-- 1. INSERT a row into prayer_wall.giving_walls with your org_id.
-- 2. Copy the resulting id into VITE_GIVING_WALL_ID in your .env.local / Netlify env vars.
-- 3. Open /giving/admin → Theme and Save to create the wall_theme row.
-- 4. Run: NOTIFY pgrst, 'reload schema';
