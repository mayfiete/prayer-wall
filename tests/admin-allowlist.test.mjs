import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const container = process.env.ADMIN_ALLOWLIST_TEST_CONTAINER
const admins = ['5356e9c6-47c3-467f-82d3-81b6da9c0323', '1c9a97ce-20be-446b-8fe6-ac877f0adda0']
const outsider = '00000000-0000-0000-0000-000000000099'
const wall = '00000000-0000-0000-0000-000000000002'
const givingWall = '00000000-0000-0000-0000-000000000003'
const commitment = '00000000-0000-0000-0000-000000000077'

function sql(query) {
  return new Promise((resolve, reject) => {
    const child = execFile('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message))
      else resolve(stdout.trim())
    })
    child.stdin.end(query)
  })
}
const asUser = (id, query, role = 'authenticated') => sql(`SET ROLE ${role}; SET request.jwt.claim.sub = '${id}'; ${query}`)
const result = text => text.split('\n').at(-1)

test('admin allowlist against an empty disposable PostgreSQL database', { skip: !container }, async t => {
  assert.ok(container.startsWith('prayer-admin-test-'), 'Use a disposable prayer-admin-test-* container')
  assert.equal(await sql("SELECT to_regnamespace('prayer_wall') IS NULL"), 't', 'Never run on a real database')
  await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${admins[0]}'), ('${admins[1]}'), ('${outsider}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    CREATE PUBLICATION supabase_realtime;
    CREATE SCHEMA storage; CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
    GRANT SELECT ON storage.objects TO anon;
    CREATE POLICY open_assets ON storage.objects FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY public_assets ON storage.objects FOR SELECT TO anon USING (true);`)
  for (const file of ['001_initial_schema.sql', '002_prayer_statements.sql', '003_rename_to_prayer_meditations.sql', '004_email_rhythms.sql', '008_wall_theme.sql', '009_prayer_warriors.sql', '010_prayer_points.sql', '011_rhythm_restructure.sql', '016_category_rhythms.sql', '018_email_logs_type.sql', '019_grant_service_role_schema.sql', '022_giving_wall.sql', '024_fix_donations_grants.sql', '026_giving_wall_stripe.sql', '029_walls_app_type.sql', '030_donation_commitments.sql', '031_donation_full_name.sql', '032_restore_commitment_public_reads.sql', '033_restrict_donation_public_reads.sql', '034_email_copy.sql']) {
    await sql(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    if (file === '001_initial_schema.sql') await sql(`INSERT INTO prayer_wall.walls (id, org_id, name, slug) VALUES ('${givingWall}', '00000000-0000-0000-0000-000000000001', 'Giving Wall', 'giving')`)
  }
  await sql(`INSERT INTO prayer_wall.commitments (id, wall_id, name, email, prayer_request) VALUES ('${commitment}', '${wall}', 'Public Name', 'private@example.com', 'Private prayer');
    INSERT INTO prayer_wall.prayer_points (commitment_id, body) VALUES ('${commitment}', 'Private point');
    INSERT INTO prayer_wall.email_copy (wall_id, copy_key, value) VALUES ('${wall}', 'greeting', 'Private copy');
    INSERT INTO prayer_wall.webhook_events (event_type, processor_event_id, raw_payload) VALUES ('test', 'evt_fixture', '{"email":"private@example.com"}');
    INSERT INTO prayer_wall.donations (giving_wall_id, name, amount_cents, email) VALUES ('${givingWall}', 'Donor', 100, 'donor-private@example.com');`)
  await sql(`INSERT INTO prayer_wall.wall_theme (wall_id) VALUES ('${wall}'), ('${givingWall}')`)
  const migrationUrl = new URL('../supabase/migrations/035_admin_allowlist.sql', import.meta.url)
  const migration = await readFile(migrationUrl, 'utf8')
  await t.test('missing approved user aborts atomically before permissions change', async () => {
    await sql(`DELETE FROM auth.users WHERE id = '${admins[1]}'`)
    await assert.rejects(sql(migration), /Both approved Auth users must exist/)
    assert.equal(await sql("SELECT to_regprocedure('prayer_wall.is_app_admin()') IS NULL"), 't')
    assert.equal(result(await asUser(outsider, 'SELECT email FROM prayer_wall.commitments')), 'private@example.com')
    await sql(`INSERT INTO auth.users VALUES ('${admins[1]}')`)
  })
  await sql(migration)

  await t.test('both approved IDs are admins; an ordinary user cannot impersonate one', async () => {
    for (const id of admins) assert.equal(result(await asUser(id, 'SELECT prayer_wall.is_app_admin()')), 't')
    assert.equal(result(await asUser(outsider, 'SELECT prayer_wall.is_app_admin()')), 'f')
    assert.equal(result(await asUser('', 'SELECT prayer_wall.is_app_admin()')), 'f')
  })
  await t.test('public wall fields work, but private direct projections and filters are denied', async () => {
    for (const role of ['anon', 'authenticated']) {
      assert.equal(result(await asUser(outsider, 'SELECT name FROM prayer_wall.commitments', role)), 'Public Name')
      await assert.rejects(asUser(outsider, 'SELECT email FROM prayer_wall.commitments', role), /permission denied/)
      await assert.rejects(asUser(outsider, 'SELECT * FROM prayer_wall.commitments', role), /permission denied/)
      await assert.rejects(asUser(outsider, "SELECT id FROM prayer_wall.commitments WHERE email = 'private@example.com'", role), /permission denied/)
      for (const field of ['email', 'first_name', 'last_name', 'full_name', 'prayer_request']) await assert.rejects(asUser(outsider, `SELECT ${field} FROM prayer_wall.commitments`, role), /permission denied/)
      for (const field of ['email', 'thank_you_sent', 'commitment_id']) await assert.rejects(asUser(outsider, `SELECT ${field} FROM prayer_wall.donations`, role), /permission denied/)
      if (role == 'anon') await assert.rejects(asUser(outsider, 'SELECT count(*) FROM prayer_wall.prayer_points', role), /permission denied/)
      else assert.equal(result(await asUser(outsider, 'SELECT count(*) FROM prayer_wall.prayer_points', role)), '0')
    }
  })
  await t.test('both public pages can read their exact display queries without administrator access', async () => {
    const prayerColumns = 'id, wall_id, name, committed_at, reminder_active, last_reminded_at'
    const givingColumns = 'id, giving_wall_id, name, amount_cents, currency, processor, processor_ref, email_opt_out, donated_at, created_at'
    for (const role of ['anon', 'authenticated']) {
      const prayer = JSON.parse(result(await asUser(outsider, `SELECT row_to_json(r) FROM (SELECT ${prayerColumns} FROM prayer_wall.commitments WHERE wall_id = '${wall}' ORDER BY committed_at DESC) r`, role)))
      assert.equal(prayer.name, 'Public Name')
      assert.deepEqual(Object.keys(prayer), prayerColumns.split(', '))
      const donation = JSON.parse(result(await asUser(outsider, `SELECT row_to_json(r) FROM (SELECT ${givingColumns} FROM prayer_wall.donations WHERE giving_wall_id = '${givingWall}' ORDER BY donated_at DESC) r`, role)))
      assert.equal(donation.name, 'Donor')
      assert.deepEqual(Object.keys(donation), givingColumns.split(', '))
      const categories = JSON.parse(result(await asUser(outsider, "SELECT jsonb_agg(r) FROM (SELECT * FROM prayer_wall.message_categories WHERE org_id = '00000000-0000-0000-0000-000000000001' AND is_active = true ORDER BY display_order) r", role)))
      assert.equal(categories.length, 8)
      for (const id of [wall, givingWall]) {
        const theme = JSON.parse(result(await asUser(outsider, `SELECT row_to_json(r) FROM (SELECT * FROM prayer_wall.wall_theme WHERE wall_id = '${id}') r`, role)))
        assert.equal(theme.wall_id, id)
      }
    }
  })
  await t.test('only approved admins can use private read RPCs', async () => {
    for (const id of admins) {
      assert.equal(result(await asUser(id, `SELECT email FROM prayer_wall.admin_read_commitments('${wall}')`)), 'private@example.com')
      assert.equal(result(await asUser(id, `SELECT email FROM prayer_wall.admin_read_donations('${givingWall}')`)), 'donor-private@example.com')
    }
    await assert.rejects(asUser(outsider, `SELECT * FROM prayer_wall.admin_read_commitments('${wall}')`), /Administrator access required/)
    await assert.rejects(asUser(outsider, `SELECT * FROM prayer_wall.admin_read_donations('${givingWall}')`), /Administrator access required/)
    await assert.rejects(asUser('', `SELECT * FROM prayer_wall.admin_read_commitments('${wall}')`, 'anon'), /permission denied/)
  })
  await t.test('ordinary accounts cannot alter admin data, while both admins can', async () => {
    assert.equal(result(await asUser(outsider, 'SELECT count(*) FROM prayer_wall.email_copy')), '0')
    assert.equal(result(await asUser(outsider, 'SELECT count(*) FROM prayer_wall.webhook_events')), '0')
    await assert.rejects(asUser(outsider, `INSERT INTO prayer_wall.email_copy (wall_id, copy_key, value) VALUES ('${wall}', 'bad', 'Bad')`), /row-level security/)
    assert.equal(result(await asUser(outsider, `WITH changed AS (UPDATE prayer_wall.commitments SET name = 'Bad' WHERE id = '${commitment}' RETURNING id) SELECT count(*) FROM changed`)), '0')
    for (const id of admins) {
      assert.equal(result(await asUser(id, 'SELECT count(*) FROM prayer_wall.prayer_points')), '1')
      assert.equal(result(await asUser(id, 'SELECT count(*) FROM prayer_wall.webhook_events')), '1')
      assert.equal(result(await asUser(id, `WITH changed AS (UPDATE prayer_wall.commitments SET name = 'Public Name' WHERE id = '${commitment}' RETURNING id) SELECT count(*) FROM changed`)), '1')
    }
  })
  await t.test('commitment email edits work for admins, but non-admin deletion is blocked', async () => {
    assert.equal(result(await asUser(outsider, `WITH removed AS (DELETE FROM prayer_wall.commitments WHERE id = '${commitment}' RETURNING id) SELECT count(*) FROM removed`)), '0')
    for (const id of admins) {
      await asUser(id, `UPDATE prayer_wall.commitments SET email = 'private@example.com', prayer_request = 'Private prayer' WHERE id = '${commitment}'`)
      assert.equal(result(await asUser(id, `SELECT email FROM prayer_wall.admin_read_commitments('${wall}') WHERE id = '${commitment}'`)), 'private@example.com')
    }
  })
  await t.test('non-admins cannot change or delete email copy despite legacy permissive policies', async () => {
    for (const statement of ["UPDATE prayer_wall.email_copy SET value = 'Bad' RETURNING id", 'DELETE FROM prayer_wall.email_copy RETURNING id']) {
      assert.equal(result(await asUser(outsider, `WITH changed AS (${statement}) SELECT count(*) FROM changed`)), '0')
    }
    assert.equal(result(await asUser(admins[0], "WITH changed AS (UPDATE prayer_wall.email_copy SET value = 'Updated' RETURNING id) SELECT count(*) FROM changed")), '1')
  })
  await t.test('ordinary signed-in users cannot read inactive categories', async () => {
    await sql("INSERT INTO prayer_wall.message_categories (org_id, name, is_active) VALUES ('00000000-0000-0000-0000-000000000001', 'Inactive fixture', false)")
    assert.equal(result(await asUser(outsider, "SELECT count(*) FROM prayer_wall.message_categories WHERE name = 'Inactive fixture'")), '0')
    assert.equal(result(await asUser(admins[0], "SELECT count(*) FROM prayer_wall.message_categories WHERE name = 'Inactive fixture'")), '1')
  })
  await t.test('public submissions and internal reads continue to work', async () => {
    for (const role of ['anon', 'authenticated']) await asUser(outsider, `INSERT INTO prayer_wall.commitments (wall_id, name, email) VALUES ('${wall}', 'Guest', 'guest@example.com') RETURNING id, name`, role)
    assert.equal(result(await asUser('', `SELECT email FROM prayer_wall.commitments WHERE id = '${commitment}'`, 'service_role')), 'private@example.com')
  })
  await t.test('payment recording stays atomic and idempotent with the final unified schema', async () => {
    const call = `SELECT prayer_wall.record_paid_donation(p_wall_id => '${givingWall}', p_processor_ref => 'pi_035_test', p_name => 'Paid Donor', p_email => 'paid-private@example.com', p_amount_cents => 500, p_currency => 'usd')`
    const first = JSON.parse(result(await asUser('', call, 'service_role')))
    const second = JSON.parse(result(await asUser('', call, 'service_role')))
    assert.equal(first.created, true)
    assert.equal(second.created, false)
    assert.equal(first.id, second.id)
    assert.equal(first.commitment_id, second.commitment_id)
    assert.equal(result(await asUser(admins[0], `SELECT email FROM prayer_wall.admin_read_donations('${givingWall}') WHERE processor_ref = 'pi_035_test'`)), 'paid-private@example.com')
    for (const role of ['anon', 'authenticated']) await assert.rejects(asUser(outsider, call, role), /permission denied/)
  })
  await t.test('storage writes are restricted in both supported asset buckets', async () => {
    for (const bucket of ['wall-assets', 'prayer-wall-images', 'email-assets']) {
      await assert.rejects(asUser(outsider, `INSERT INTO storage.objects (bucket_id, name) VALUES ('${bucket}', 'bad.png')`), /row-level security/)
      for (const id of admins) await asUser(id, `INSERT INTO storage.objects (bucket_id, name) VALUES ('${bucket}', '${id}.png')`)
    }
  })
  await t.test('non-admins cannot overwrite, delete or move protected storage objects', async () => {
    for (const command of ["UPDATE storage.objects SET name = 'bad.png' WHERE bucket_id = 'wall-assets' RETURNING id", "DELETE FROM storage.objects WHERE bucket_id = 'wall-assets' RETURNING id", "UPDATE storage.objects SET bucket_id = 'unrelated' WHERE bucket_id = 'wall-assets' RETURNING id"]) {
      assert.equal(result(await asUser(outsider, `WITH changed AS (${command}) SELECT count(*) FROM changed`)), '0')
    }
    // Conversely, moving a permitted unrelated object into a protected bucket is denied.
    await asUser(outsider, "INSERT INTO storage.objects (bucket_id, name) VALUES ('unrelated', 'outsider.png')")
    await assert.rejects(asUser(outsider, "UPDATE storage.objects SET bucket_id = 'wall-assets' WHERE bucket_id = 'unrelated'"), /row-level security/)
    assert.equal(result(await asUser(admins[0], "WITH changed AS (UPDATE storage.objects SET name = 'updated.png' WHERE bucket_id = 'wall-assets' RETURNING id) SELECT count(*) FROM changed")), '2')
  })
  {
    await t.test('migration is safe to reapply', async () => {
      await sql(await readFile(migrationUrl, 'utf8'))
      assert.equal(result(await asUser(admins[0], 'SELECT prayer_wall.is_app_admin()')), 't')
    })
  }
})
