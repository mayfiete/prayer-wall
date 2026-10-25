-- Purge test prayers — STEP 1 of 3: PREVIEW (read-only, changes nothing).
--
-- Scope: everything people created on PRAYER walls (walls.app_type = 'prayer'):
-- commitments (the stonemasons), their categories, rhythms, prayer points, and
-- email_logs. The giving wall and all configuration (walls, organizations,
-- message_categories, email_rhythms, prayer_meditations, wall_theme,
-- email_copy) are never touched.
--
-- Run in the Supabase SQL Editor. Review every result set before step 2.

-- A. Walls and what each holds. Only app_type = 'prayer' rows are in scope.
SELECT w.id AS wall_id, w.name, w.slug, w.app_type,
       (SELECT count(*) FROM prayer_wall.commitments c WHERE c.wall_id = w.id) AS commitments
FROM prayer_wall.walls w
ORDER BY w.app_type, w.name;

-- B. The commitments that WILL be purged. The row count is the number you type
--    into step 2.
SELECT c.id AS commitment_id, w.slug AS wall, c.committed_at, c.name, c.email
FROM prayer_wall.commitments c
JOIN prayer_wall.walls w ON w.id = c.wall_id
WHERE w.app_type = 'prayer'
ORDER BY c.committed_at;

-- C. Commitments that will NOT be touched (non-prayer walls) — should be only
--    the giving wall's payers.
SELECT w.slug AS wall, w.app_type, count(*) AS commitments
FROM prayer_wall.commitments c
JOIN prayer_wall.walls w ON w.id = c.wall_id
WHERE w.app_type IS DISTINCT FROM 'prayer'
GROUP BY 1, 2;

-- D. Prayer-wall commitments tied to a donation. Must be empty; step 2 aborts
--    if it is not.
SELECT d.id AS donation_id, d.commitment_id
FROM prayer_wall.donations d
JOIN prayer_wall.commitments c ON c.id = d.commitment_id
JOIN prayer_wall.walls w ON w.id = c.wall_id
WHERE w.app_type = 'prayer';

-- E. Everything step 2 would delete, by table.
WITH w AS (SELECT id FROM prayer_wall.walls WHERE app_type = 'prayer'),
     c AS (SELECT id FROM prayer_wall.commitments WHERE wall_id IN (SELECT id FROM w))
SELECT 'commitments' AS target, count(*) AS rows FROM c
UNION ALL SELECT 'commitment_categories', count(*) FROM prayer_wall.commitment_categories WHERE commitment_id IN (SELECT id FROM c)
UNION ALL SELECT 'commitment_rhythms',    count(*) FROM prayer_wall.commitment_rhythms    WHERE commitment_id IN (SELECT id FROM c)
UNION ALL SELECT 'prayer_points',         count(*) FROM prayer_wall.prayer_points         WHERE commitment_id IN (SELECT id FROM c)
UNION ALL SELECT 'email_logs',            count(*) FROM prayer_wall.email_logs
  WHERE wall_id IN (SELECT id FROM w) OR commitment_id IN (SELECT id FROM c);

-- F. What stays, for comparison after the purge.
SELECT 'walls' AS kept, count(*) FROM prayer_wall.walls
UNION ALL SELECT 'message_categories', count(*) FROM prayer_wall.message_categories
UNION ALL SELECT 'email_rhythms',      count(*) FROM prayer_wall.email_rhythms
UNION ALL SELECT 'category_rhythms',   count(*) FROM prayer_wall.category_rhythms
UNION ALL SELECT 'prayer_meditations', count(*) FROM prayer_wall.prayer_meditations
UNION ALL SELECT 'giving commitments', count(*) FROM prayer_wall.commitments c
  JOIN prayer_wall.walls w ON w.id = c.wall_id WHERE w.app_type = 'giving'
UNION ALL SELECT 'donations',          count(*) FROM prayer_wall.donations;
