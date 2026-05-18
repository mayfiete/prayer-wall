-- ============================================================
-- Email Rhythms — per-wall cadence configuration
-- ============================================================

CREATE TYPE prayer_wall.email_cadence AS ENUM ('daily', 'weekly', 'monthly');

CREATE TABLE prayer_wall.email_rhythms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES prayer_wall.organizations(id) ON DELETE CASCADE NOT NULL,
  wall_id      UUID REFERENCES prayer_wall.walls(id) ON DELETE CASCADE NOT NULL,
  cadence      prayer_wall.email_cadence NOT NULL DEFAULT 'weekly',
  -- weekly: 0=Sunday … 6=Saturday
  day_of_week  SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
  -- monthly: 1–28
  day_of_month SMALLINT CHECK (day_of_month BETWEEN 1 AND 28),
  -- local time to send, stored as HH:MM
  send_time    TIME NOT NULL DEFAULT '09:00',
  -- IANA timezone string, e.g. 'America/New_York'
  timezone     TEXT NOT NULL DEFAULT 'America/New_York',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (wall_id)
);

CREATE INDEX ix_email_rhythms_wall ON prayer_wall.email_rhythms(wall_id);
CREATE INDEX ix_email_rhythms_org  ON prayer_wall.email_rhythms(org_id);

-- RLS
ALTER TABLE prayer_wall.email_rhythms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rhythms_admin_all"
  ON prayer_wall.email_rhythms FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON prayer_wall.email_rhythms TO authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION prayer_wall.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_rhythms_updated_at
  BEFORE UPDATE ON prayer_wall.email_rhythms
  FOR EACH ROW EXECUTE FUNCTION prayer_wall.set_updated_at();

-- Seed: default weekly rhythm for the main wall (Sunday 9 AM ET)
INSERT INTO prayer_wall.email_rhythms (org_id, wall_id, cadence, day_of_week, send_time, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'weekly',
  0,
  '09:00',
  'America/New_York'
);
