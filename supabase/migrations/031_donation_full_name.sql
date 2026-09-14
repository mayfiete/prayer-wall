-- Run after migration 030, before deploying the updated payment functions.
-- full_name stores the resolved public wall name, not a separate billing identity.
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('prayer_wall.record_paid_donation(uuid,text,text,text,text,text,integer,text)') IS NULL THEN
    RAISE EXCEPTION 'Run migration 030 before migration 031.';
  END IF;
END $$;

ALTER TABLE prayer_wall.commitments
  ADD COLUMN IF NOT EXISTS full_name text;

COMMENT ON COLUMN prayer_wall.commitments.full_name IS
  'Resolved giving-wall display name: optional wall name, billing-name fallback, or Anonymous.';

-- Preserve historical first/last names and ordinary prayer commitments.
UPDATE prayer_wall.commitments c
SET full_name = d.name
FROM prayer_wall.donations d
WHERE d.commitment_id = c.id AND c.full_name IS NULL;

-- REVOKE also removes column grants; restore the public wall's projection.
REVOKE SELECT ON prayer_wall.commitments FROM PUBLIC, anon;
REVOKE SELECT (full_name) ON prayer_wall.commitments FROM PUBLIC, anon;
GRANT SELECT (id, wall_id, name, committed_at, reminder_active, last_reminded_at)
  ON prayer_wall.commitments TO anon;

-- Defaults allow the new webhook to omit first/last names. Keeping the same
-- signature also lets the old deployed webhook finish payments during rollout.
CREATE OR REPLACE FUNCTION prayer_wall.record_paid_donation(
  p_wall_id uuid,
  p_processor_ref text,
  p_name text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_amount_cents integer DEFAULT NULL,
  p_currency text DEFAULT NULL
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
      wall_id, name, full_name, first_name, last_name, email, committed_at, reminder_active
    ) VALUES (
      donation.giving_wall_id, donation.name, donation.name,
      nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), ''),
      coalesce(donation.email, p_email, ''), donation.donated_at, false
    ) RETURNING id INTO new_commitment_id;

    UPDATE prayer_wall.donations SET commitment_id = new_commitment_id
      WHERE id = donation.id;
    donation.commitment_id := new_commitment_id;
  ELSE
    UPDATE prayer_wall.commitments SET full_name = donation.name
      WHERE id = donation.commitment_id AND full_name IS NULL;
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
