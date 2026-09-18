BEGIN;

REVOKE SELECT ON prayer_wall.donations FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, giving_wall_id, name, amount_cents, currency, processor,
  processor_ref, email_opt_out, donated_at, created_at
) ON prayer_wall.donations TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
