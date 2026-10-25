-- Purge test donations — STEP 1 of 3: PREVIEW (read-only, changes nothing).
--
-- Why this works: test and prod share the same wall id and metadata, so rows
-- are classified by Stripe's own flag. giving-wall-webhook stores every event
-- in prayer_wall.webhook_events with raw_payload.livemode and, once processed,
-- the donation_id it created. livemode = false  =>  a Stripe TEST payment.
-- (processor_ref is a pi_… id and does NOT reveal the mode.)
--
-- Run in the Supabase SQL Editor. Review every result set before step 2.

-- A. How many donations does each mode account for?
SELECT
  coalesce(e.raw_payload->>'livemode', '(no webhook link)') AS livemode,
  count(DISTINCT d.id)                                      AS donations,
  coalesce(sum(d.amount_cents), 0) / 100.0                  AS total_amount
FROM prayer_wall.donations d
LEFT JOIN prayer_wall.webhook_events e ON e.donation_id = d.id
GROUP BY 1
ORDER BY 1;

-- B. Donations that WILL be purged (livemode = false). Check names/emails/dates.
--    The row count here is the number you type into step 2.
SELECT d.id AS donation_id, d.donated_at, d.name, d.email, d.amount_cents,
       d.processor_ref, d.commitment_id, e.processor_event_id
FROM prayer_wall.donations d
JOIN prayer_wall.webhook_events e ON e.donation_id = d.id
WHERE e.raw_payload->>'livemode' = 'false'
ORDER BY d.donated_at;

-- C. Donations that will NOT be touched, but have no webhook audit row, so
--    they cannot be classified automatically (e.g. inserted by hand or before
--    migration 026). Review each: any that are test data must be listed by id
--    in v_extra_donation_ids in step 2. An empty result is the expected case.
SELECT d.id AS donation_id, d.donated_at, d.name, d.email, d.amount_cents, d.processor_ref
FROM prayer_wall.donations d
WHERE NOT EXISTS (SELECT 1 FROM prayer_wall.webhook_events e WHERE e.donation_id = d.id)
ORDER BY d.donated_at;

-- D. Donations linked to BOTH test and live events. Must be empty; step 2
--    aborts if it is not.
SELECT donation_id
FROM prayer_wall.webhook_events
WHERE donation_id IS NOT NULL
GROUP BY donation_id
HAVING bool_or(raw_payload->>'livemode' = 'false')
   AND bool_or(raw_payload->>'livemode' IS DISTINCT FROM 'false');

-- E. Everything step 2 would delete, by table.
WITH test_donations AS (
  SELECT DISTINCT donation_id AS id
  FROM prayer_wall.webhook_events
  WHERE donation_id IS NOT NULL AND raw_payload->>'livemode' = 'false'
)
SELECT 'donations' AS target, count(*) AS rows FROM test_donations
UNION ALL
SELECT 'commitments (the test payers)', count(DISTINCT d.commitment_id)
  FROM prayer_wall.donations d JOIN test_donations t ON t.id = d.id
UNION ALL
SELECT 'webhook_events (all livemode=false)', count(*)
  FROM prayer_wall.webhook_events WHERE raw_payload->>'livemode' = 'false'
UNION ALL
SELECT 'email_logs (thank-you emails)', count(*)
  FROM prayer_wall.email_logs WHERE donation_id IN (SELECT id FROM test_donations);

-- F. Live data that will be KEPT, for a sanity check against Stripe's live dashboard.
SELECT count(DISTINCT d.id) AS live_donations, coalesce(sum(d.amount_cents), 0) / 100.0 AS live_total
FROM prayer_wall.donations d
JOIN prayer_wall.webhook_events e ON e.donation_id = d.id
WHERE e.raw_payload->>'livemode' = 'true';
