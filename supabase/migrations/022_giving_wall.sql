-- Migration 022: Giving Wall — donations table
-- All tables remain in the prayer_wall schema alongside the Prayer Foundation tables.

-- ── donations ─────────────────────────────────────────────────────────────────
-- Authoritative record created ONLY by the giving-wall-webhook edge function.
-- The browser never writes to this table directly.

CREATE TABLE IF NOT EXISTS prayer_wall.donations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giving_wall_id   uuid NOT NULL REFERENCES prayer_wall.walls(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  amount_cents     integer NOT NULL CHECK (amount_cents >= 0),
  currency         text NOT NULL DEFAULT 'usd',
  processor        text NOT NULL DEFAULT 'stripe',
  -- processor_ref is the Stripe charge or payment-intent ID; UNIQUE enforces idempotency
  processor_ref    text UNIQUE,
  -- email is stored server-side only; never returned to anon browser clients
  email            text,
  email_opt_out    boolean NOT NULL DEFAULT false,
  donated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS donations_giving_wall_id_idx ON prayer_wall.donations (giving_wall_id);
CREATE INDEX IF NOT EXISTS donations_donated_at_idx     ON prayer_wall.donations (giving_wall_id, donated_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE prayer_wall.donations ENABLE ROW LEVEL SECURITY;

-- Public wall: anyone can read display fields; email is excluded via column grants below
CREATE POLICY "donations_public_read" ON prayer_wall.donations
  FOR SELECT USING (true);

-- Only service_role (webhook edge function) may insert
CREATE POLICY "donations_service_insert" ON prayer_wall.donations
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service_role may update (e.g. opt-out flag set by unsubscribe function)
CREATE POLICY "donations_service_update" ON prayer_wall.donations
  FOR UPDATE USING (auth.role() = 'service_role');

-- Strip email from anon/authenticated reads — service_role bypasses column grants
REVOKE SELECT ON prayer_wall.donations FROM anon, authenticated;
GRANT  SELECT (id, giving_wall_id, name, amount_cents, currency, processor_ref, email_opt_out, donated_at, created_at)
  ON prayer_wall.donations TO anon, authenticated;

-- ── Grant service_role full access ────────────────────────────────────────────
GRANT ALL ON prayer_wall.donations TO service_role;

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
