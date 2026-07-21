-- ============================================================
-- 018_reorder_categories.sql
-- Reorders prayer categories to the requested sequence:
-- 1. Students
-- 2. HCA Families
-- 3. Faculty & Staff
-- 4. Growth & Future
-- 5. Financial Provision
-- All other categories get higher display_order values.
-- ============================================================

UPDATE prayer_wall.message_categories SET display_order = 1 WHERE org_id = '00000000-0000-0000-0000-000000000001' AND name = 'Students';
UPDATE prayer_wall.message_categories SET display_order = 2 WHERE org_id = '00000000-0000-0000-0000-000000000001' AND name = 'HCA Families';
UPDATE prayer_wall.message_categories SET display_order = 3 WHERE org_id = '00000000-0000-0000-0000-000000000001' AND name = 'Faculty & Staff';
UPDATE prayer_wall.message_categories SET display_order = 4 WHERE org_id = '00000000-0000-0000-0000-000000000001' AND name = 'Growth & Future';
UPDATE prayer_wall.message_categories SET display_order = 5 WHERE org_id = '00000000-0000-0000-0000-000000000001' AND name = 'Financial Provision';
