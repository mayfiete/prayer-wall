BEGIN;

DO $$
BEGIN
  IF to_regclass('prayer_wall.giving_walls') IS NOT NULL THEN
    RAISE EXCEPTION 'This migration requires unified prayer_wall.walls; review migration 029 first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'prayer_wall' AND table_name = 'walls' AND column_name = 'app_type'
  ) THEN
    RAISE EXCEPTION 'Run migration 029 before migration 030.';
  END IF;
END $$;

ALTER TABLE prayer_wall.commitments
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

ALTER TABLE prayer_wall.donations
  ADD COLUMN IF NOT EXISTS commitment_id uuid REFERENCES prayer_wall.commitments(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS donations_commitment_id_idx
  ON prayer_wall.donations (commitment_id);

REVOKE SELECT ON prayer_wall.commitments FROM PUBLIC, anon;
REVOKE SELECT (email, first_name, last_name) ON prayer_wall.commitments FROM PUBLIC, anon;
GRANT SELECT (id, wall_id, name, committed_at, reminder_active, last_reminded_at)
  ON prayer_wall.commitments TO anon;
GRANT SELECT, INSERT, UPDATE ON prayer_wall.commitments TO service_role;

CREATE OR REPLACE FUNCTION prayer_wall.record_paid_donation(
  p_wall_id uuid,
  p_processor_ref text,
  p_name text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_amount_cents integer,
  p_currency text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  donation prayer_wall.donations%ROWTYPE;
  new_commitment_id uuid;
  inserted_count integer;
BEGIN
  IF p_processor_ref IS NULL OR btrim(p_processor_ref) = ''
    OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 100
    OR p_amount_cents IS NULL OR p_amount_cents <= 0
    OR p_currency IS NULL OR p_currency !~ '^[a-z]{3}$'
  THEN
    RAISE EXCEPTION 'Invalid paid donation data';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM prayer_wall.walls WHERE id = p_wall_id AND app_type = 'giving'
  ) THEN
    RAISE EXCEPTION 'The donation wall must exist in prayer_wall.walls with app_type giving';
  END IF;

  INSERT INTO prayer_wall.donations (
    giving_wall_id, name, amount_cents, currency, processor, processor_ref, email
  ) VALUES (
    p_wall_id, p_name, p_amount_cents, p_currency, 'stripe', p_processor_ref, p_email
  ) ON CONFLICT (processor_ref) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  SELECT * INTO STRICT donation FROM prayer_wall.donations
    WHERE processor_ref = p_processor_ref FOR UPDATE;

  IF donation.giving_wall_id <> p_wall_id OR donation.processor <> 'stripe'
    OR donation.amount_cents <> p_amount_cents OR donation.currency <> p_currency
  THEN
    RAISE EXCEPTION 'Existing donation does not match the paid Stripe session';
  END IF;

  IF donation.commitment_id IS NULL THEN
    INSERT INTO prayer_wall.commitments (
      wall_id, name, first_name, last_name, email, committed_at, reminder_active
    ) VALUES (
      donation.giving_wall_id, donation.name,
      nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), ''),
      coalesce(donation.email, p_email, ''), donation.donated_at, false
    ) RETURNING id INTO new_commitment_id;

    UPDATE prayer_wall.donations SET commitment_id = new_commitment_id
      WHERE id = donation.id;
    donation.commitment_id := new_commitment_id;
  END IF;

  RETURN jsonb_build_object(
    'id', donation.id,
    'commitment_id', donation.commitment_id,
    'created', inserted_count = 1
  );
END;
$$;

REVOKE ALL ON FUNCTION prayer_wall.record_paid_donation(uuid, text, text, text, text, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION prayer_wall.record_paid_donation(uuid, text, text, text, text, text, integer, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
