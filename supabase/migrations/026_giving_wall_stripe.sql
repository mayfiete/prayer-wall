-- Migration 026: Stripe Checkout support for the Giving Wall
--   - webhook_events   raw audit log of every processor event (ADR-004)
--   - donations        thank_you_sent lifecycle flag
--   - email_logs       allow donation_thank_you rows for a giving wall
--   - realtime         publish donations so bricks animate in live
--
-- Run this in the Supabase SQL Editor, then run migration 027 if the
-- diagnostic at the bottom tells you the donations FK needs repointing.

-- ── 1. Webhook event audit log ────────────────────────────────────────────────
-- Every inbound processor POST is recorded here BEFORE any processing, so a
-- payment that never became a brick can always be explained without calling
-- Stripe support. giving_wall_id is deliberately FK-free: an audit row must
-- never fail to insert because of a misconfigured wall id.

CREATE TABLE IF NOT EXISTS prayer_wall.webhook_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giving_wall_id      uuid,
  processor           text NOT NULL DEFAULT 'stripe',
  event_type          text NOT NULL,
  -- Stripe Event ID (evt_…). UNIQUE gives us at-least-once delivery protection.
  processor_event_id  text NOT NULL UNIQUE,
  raw_payload         jsonb NOT NULL,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processed', 'skipped', 'failed')),
  donation_id         uuid REFERENCES prayer_wall.donations(id) ON DELETE SET NULL,
  error_message       text,
  received_at         timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS webhook_events_event_id_idx    ON prayer_wall.webhook_events (processor_event_id);
CREATE INDEX IF NOT EXISTS webhook_events_status_idx      ON prayer_wall.webhook_events (status);
CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx ON prayer_wall.webhook_events (received_at DESC);

ALTER TABLE prayer_wall.webhook_events ENABLE ROW LEVEL SECURITY;

-- No anon access at all; admins may read for debugging.
DROP POLICY IF EXISTS "webhook_events_admin_read" ON prayer_wall.webhook_events;
CREATE POLICY "webhook_events_admin_read" ON prayer_wall.webhook_events
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON prayer_wall.webhook_events TO authenticated;
GRANT ALL    ON prayer_wall.webhook_events TO service_role;

-- ── 2. Donation thank-you lifecycle ───────────────────────────────────────────
ALTER TABLE prayer_wall.donations
  ADD COLUMN IF NOT EXISTS thank_you_sent boolean NOT NULL DEFAULT false;

-- ── 3. email_logs: allow giving wall thank-you rows ───────────────────────────
-- email_logs.wall_id has a NOT NULL FK to prayer_wall.walls(id). A giving wall
-- lives in prayer_wall.giving_walls, so donation emails cannot populate it.
-- Make wall_id nullable and add a parallel giving_wall_id column.

ALTER TABLE prayer_wall.email_logs
  ALTER COLUMN wall_id DROP NOT NULL;

ALTER TABLE prayer_wall.email_logs
  ADD COLUMN IF NOT EXISTS giving_wall_id uuid,
  ADD COLUMN IF NOT EXISTS donation_id uuid REFERENCES prayer_wall.donations(id) ON DELETE SET NULL;

ALTER TABLE prayer_wall.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_has_wall;
ALTER TABLE prayer_wall.email_logs
  ADD CONSTRAINT email_logs_has_wall
    CHECK (wall_id IS NOT NULL OR giving_wall_id IS NOT NULL);

-- Extend the email_type CHECK from migration 018 with the donation thank-you.
ALTER TABLE prayer_wall.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE prayer_wall.email_logs
  ADD CONSTRAINT email_logs_email_type_check
    CHECK (email_type IN ('reminder', 'confirmation', 'summary', 'donation_thank_you'));

CREATE INDEX IF NOT EXISTS email_logs_giving_wall_idx ON prayer_wall.email_logs (giving_wall_id);

-- ── 4. Realtime ───────────────────────────────────────────────────────────────
-- Migration 022 created donations but never published them, so bricks only
-- appeared after a page reload. webhook_events stays unpublished (internal).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'prayer_wall'
      AND tablename = 'donations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE prayer_wall.donations;
  END IF;
END $$;

-- ── 5. Reload PostgREST schema cache ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ── 6. Diagnostic — run this and check the result ─────────────────────────────
-- Migration 022 pointed donations.giving_wall_id at prayer_wall.walls(id), but
-- migration 023 later added prayer_wall.giving_walls. The webhook INSERT will
-- fail with a foreign-key violation unless VITE_GIVING_WALL_ID exists in
-- whichever table the constraint points at. Replace the UUID below with your
-- VITE_GIVING_WALL_ID and confirm you get at least one 'true'.
--
-- SELECT
--   (SELECT count(*) FROM prayer_wall.walls        WHERE id = '<VITE_GIVING_WALL_ID>') > 0 AS in_walls,
--   (SELECT count(*) FROM prayer_wall.giving_walls WHERE id = '<VITE_GIVING_WALL_ID>') > 0 AS in_giving_walls,
--   (SELECT confrelid::regclass::text
--      FROM pg_constraint
--     WHERE conname = 'donations_giving_wall_id_fkey') AS fk_points_at;
