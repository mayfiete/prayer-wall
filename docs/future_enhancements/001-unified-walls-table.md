# FE-001: Unified `walls` Table with `app_type` Discriminator

**Status:** Proposed  
**Created:** 2026-08-24  

## Problem

The schema currently has two parallel tables for wall identity:
- `prayer_wall.walls` — prayer wall rows
- `prayer_wall.giving_walls` — giving wall rows (added in migration 023)

`wall_theme`, `email_rhythms`, `email_logs`, and `donations` all reference wall IDs but point to different parent tables depending on product. This forced migration 025 to drop the FK on `wall_theme.wall_id` as a workaround, losing referential integrity.

## Proposed Solution

Add an `app_type` discriminator column to `walls` and retire `giving_walls`:

```sql
ALTER TABLE prayer_wall.walls
  ADD COLUMN app_type text NOT NULL DEFAULT 'prayer'
  CHECK (app_type IN ('prayer', 'giving'));

INSERT INTO prayer_wall.walls (id, org_id, name, slug, app_type, created_at)
SELECT id, org_id, name, slug, 'giving', created_at
FROM prayer_wall.giving_walls;

ALTER TABLE prayer_wall.wall_theme
  ADD CONSTRAINT wall_theme_wall_id_fkey
  FOREIGN KEY (wall_id) REFERENCES prayer_wall.walls(id) ON DELETE CASCADE;

DROP TABLE prayer_wall.giving_walls;

NOTIFY pgrst, 'reload schema';
```

## Benefits

- Single FK parent for all wall-referencing tables (`wall_theme`, `email_rhythms`, `donations`, `email_logs`)
- Referential integrity restored on `wall_theme.wall_id`
- Adding future app types (memorial wall, fundraising wall) requires no new table — just a new `app_type` value
- `VITE_GIVING_WALL_ID` continues to work as-is; the UUID just lives in `walls` instead of `giving_walls`

## Considerations

- Requires a data migration to move existing `giving_walls` rows into `walls`
- `donations.giving_wall_id` FK should be updated to reference `walls.id` explicitly
- `types.ts` must be updated to reflect the new column and the removed `giving_walls` table
- Any queries that filter by table (e.g. "list all prayer walls") must add `WHERE app_type = 'prayer'`
