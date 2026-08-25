-- Migration 025: Drop FK from wall_theme.wall_id → walls
-- wall_theme is shared by both the prayer wall (walls table) and the giving wall
-- (giving_walls table). The hard FK to walls.id prevents giving wall theme saves.
-- wall_id is kept as a uuid discriminator; referential integrity is enforced
-- by application logic (ThemeAdmin requires a valid wallId prop).

ALTER TABLE prayer_wall.wall_theme
  DROP CONSTRAINT wall_theme_wall_id_fkey;

NOTIFY pgrst, 'reload schema';
