# Activate the two-admin allowlist

The local app now uses the database's `is_app_admin()` check. Migration 035 contains these two approved Supabase Auth user IDs:

- `5356e9c6-47c3-467f-82d3-81b6da9c0323`
- `1c9a97ce-20be-446b-8fe6-ac877f0adda0`

Both accounts are administrators across this app's walls. Public visitors can still view the walls and submit prayer commitments. No new Edge Function or secret is required.

## Simple rollout

1. In the intended Supabase project, open **Authentication → Users** and confirm both complete UUIDs exist and each account can sign in with email/password. The migration aborts if either account is missing. It does not create accounts or set passwords.
2. In **SQL Editor**, run the entire file [`035_admin_allowlist.sql`](../supabase/migrations/035_admin_allowlist.sql). Run only migration 035 against the current application schema; it checks that the required tables exist. Do not replay all historical migrations as a batch: migration 027 is explicitly inapplicable to the unified-walls deployment. The file includes `NOTIFY pgrst, 'reload schema';`; wait for the API cache to refresh.
3. Rebuild and deploy this checkout using your existing hosting workflow (`npm run build` for the build). The app and migration must be rolled out together: the new login guard requires the new RPC, and the old private commitment query stops working after the migration.
4. Sign out, then sign in as each approved account at `/admin` and `/giving/admin`. Confirm private commitment details load and category/theme/email-copy edits and asset uploads work. `VITE_ADMIN_EMAIL` is obsolete and can be removed from hosting environment settings.
5. In a separate browser session, verify a non-admin account cannot enter admin pages or read private data directly. Check that the public walls load, new stones appear and commitment submission still works.

## What the migration changes

- A fixed database function checks `auth.uid()` against the two approved UUIDs. The browser cannot supply the checked UUID as an argument.
- Anonymous and ordinary authenticated clients have matching public column projections on commitments and donations. Public theme reads are explicitly granted so both walls retain their branding without a login.
- Private commitment and donation reads use read-only, administrator-checked RPCs. These functions have a fixed empty search path and fully qualified table references.
- Individual prayer points, commitment/category associations, email schedules/copy and raw email/payment audit records are restricted to approved admins.
- Restrictive policies block ordinary authenticated users from administrative writes even when old permissive policies still exist. Public commitment insertion and category attachment remain available.
- Storage uploads/updates/deletes are protected in `wall-assets`, `prayer-wall-images` and `email-assets`. If `VITE_ASSETS_BUCKET` uses another bucket, include that exact bucket in the migration before running it. Public image reads are preserved.
- Internal service-role operations retain their existing permissions.

The public projection initially preserves current client compatibility, including reminder status and donation operational fields. Reducing this further requires updating public domain types and queries together. Public submission abuse, email endpoint authorization/rate limits and unsubscribe tokens are separate remaining work. In particular, unrestricted public category attachment can still add another known commitment to reminder categories; migration 035 does not authorize ownership of those public inserts.

## Verify API and Realtime privacy

Use staging and synthetic records first. The PostgreSQL regression tests validate role permissions; they do not validate the deployed PostgREST/Realtime services.

| Check | Anonymous | Ordinary authenticated | Approved administrator |
| --- | --- | --- | --- |
| Read public commitment/donation projection | Allowed | Allowed | Allowed |
| Direct `select('email')`, `select('*')`, or filtering by private email | Denied | Denied | Denied |
| `admin_read_commitments` / `admin_read_donations` RPC | Denied | Denied | Allowed |
| Read individual prayer points or webhook/email records | Denied | No rows or denied | Allowed |
| Admin mutations / asset upload | Denied | No rows or denied | Allowed |

For Realtime, subscribe as anonymous and ordinary authenticated users before applying the migration. Insert and update synthetic commitments and donations afterward. Inspect the **raw event**, including `new` and `old`, for email addresses, prayer requests and private keys. Repeat using new subscriptions and delete events. Public wall events must still arrive. Reading only the React-mapped name does not prove the raw payload is safe. Do not log real personal data while checking.

If any private field remains available through the API or Realtime, stop the rollout and fix the effective grants/policies. Reverting to broad authenticated SELECT reopens the original exposure.

## Local verification

Use an empty disposable PostgreSQL 17 container with logical replication enabled and a name beginning `prayer-admin-test-`. Never use a real project. The test creates synthetic Auth, Storage and historical migration fixtures and refuses an existing application schema.

```powershell
$env:ADMIN_ALLOWLIST_TEST_CONTAINER = 'prayer-admin-test-your-disposable-container'
node --test tests/admin-allowlist.test.mjs
node --test tests/admin-access.test.mjs
npm run build
```

For later administrator changes, update the UUID list in a new migration and keep the Auth account IDs stable. Disabling an account should also remove it from the list if existing sessions must immediately lose application privileges.
