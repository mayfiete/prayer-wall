import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const container = process.env.DONATION_TEST_CONTAINER
const wallId = '00000000-0000-0000-0000-000000000003'
const prayerWallId = '00000000-0000-0000-0000-000000000002'

function sql(query) {
  return new Promise((resolve, reject) => {
    const child = execFile('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message))
      else resolve(stdout.trim())
    })
    child.stdin.end(query)
  })
}

function record(ref, wall = wallId, amount = 100) {
  return `SELECT prayer_wall.record_paid_donation('${wall}', '${ref}', 'Anonymous', 'Mary Jane', 'van der Berg', 'test@example.com', ${amount}, 'usd');`
}

test('donation persistence migration on a disposable Postgres database', { skip: !container }, async (t) => {
  const empty = await sql("SELECT to_regnamespace('prayer_wall') IS NULL;")
  assert.equal(empty, 't', 'Use an empty disposable database, never a real project')
  await sql(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    CREATE PUBLICATION supabase_realtime;
  `)
  for (const file of ['001_initial_schema.sql', '009_prayer_warriors.sql', '018_email_logs_type.sql', '019_grant_service_role_schema.sql', '022_giving_wall.sql', '024_fix_donations_grants.sql', '026_giving_wall_stripe.sql']) {
    await sql(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
  }
  await sql(`INSERT INTO prayer_wall.walls (id, org_id, name, slug) VALUES ('${wallId}', '00000000-0000-0000-0000-000000000001', 'Giving Wall', 'giving');`)
  await sql('CREATE TABLE prayer_wall.wall_theme (wall_id uuid);')
  await sql(await readFile(new URL('../migrations/029_walls_app_type.sql', import.meta.url), 'utf8'))
  const migration = await readFile(new URL('../migrations/030_donation_commitments.sql', import.meta.url), 'utf8')
  await sql(migration)

  await t.test('service role creates the linked donation and named commitment', async () => {
    const result = JSON.parse((await sql(`SET ROLE service_role; ${record('pi_one')}`)).split('\n').at(-1))
    assert.equal(result.created, true)
    assert.ok(result.commitment_id)
    const row = JSON.parse(await sql(`SELECT row_to_json(r) FROM (
      SELECT d.amount_cents, d.giving_wall_id, c.wall_id, c.name, c.first_name, c.last_name, c.email, c.reminder_active
      FROM prayer_wall.donations d JOIN prayer_wall.commitments c ON c.id = d.commitment_id
      WHERE d.processor_ref = 'pi_one'
    ) r;`))
    assert.deepEqual(row, { amount_cents: 100, giving_wall_id: wallId, wall_id: wallId, name: 'Anonymous', first_name: 'Mary Jane', last_name: 'van der Berg', email: 'test@example.com', reminder_active: false })
  })

  await t.test('retry returns the same records', async () => {
    const first = JSON.parse(await sql(record('pi_one')))
    const second = JSON.parse(await sql(record('pi_one')))
    assert.equal(first.created, false)
    assert.deepEqual(first, second)
    assert.equal(await sql('SELECT count(*) FROM prayer_wall.commitments;'), '1')
  })

  await t.test('concurrent deliveries create one donation and commitment', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => sql(record('pi_concurrent'))))
    const records = results.map(JSON.parse)
    assert.equal(new Set(records.map((row) => row.commitment_id)).size, 1)
    assert.equal(records.filter((row) => row.created).length, 1)
    assert.equal(await sql('SELECT count(*) FROM prayer_wall.commitments;'), '2')
  })

  await t.test('existing donations gain a commitment without another donation', async () => {
    await sql(`INSERT INTO prayer_wall.donations (giving_wall_id, name, amount_cents, processor_ref) VALUES ('${wallId}', 'Legacy Donor', 100, 'pi_legacy');`)
    const result = JSON.parse(await sql(record('pi_legacy')))
    assert.equal(result.created, false)
    assert.ok(result.commitment_id)
    assert.equal(await sql('SELECT count(*) FROM prayer_wall.donations;'), '3')
    assert.equal(await sql(`SELECT name FROM prayer_wall.commitments WHERE id = '${result.commitment_id}';`), 'Legacy Donor')
  })

  await t.test('commitment failure rolls back the donation; retry succeeds', async () => {
    await sql(`
      CREATE FUNCTION prayer_wall.reject_test_commitment() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.first_name = 'Reject' THEN RAISE EXCEPTION 'test commitment failure'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER reject_test_commitment BEFORE INSERT ON prayer_wall.commitments
        FOR EACH ROW EXECUTE FUNCTION prayer_wall.reject_test_commitment();
    `)
    await assert.rejects(sql(record('pi_retry').replace("'Mary Jane'", "'Reject'")), /test commitment failure/)
    assert.equal(await sql("SELECT count(*) FROM prayer_wall.donations WHERE processor_ref = 'pi_retry';"), '0')
    assert.equal(JSON.parse(await sql(record('pi_retry'))).created, true)
  })

  await t.test('wrong wall and inconsistent payment details are rejected', async () => {
    await assert.rejects(sql(record('pi_prayer', prayerWallId)), /app_type giving/)
    await assert.rejects(sql(record('pi_missing', '00000000-0000-0000-0000-000000000099')), /app_type giving/)
    await assert.rejects(sql(record('pi_one', wallId, 200)), /does not match/)
    await assert.rejects(sql(record('pi_zero', wallId, 0)), /Invalid paid donation/)
  })

  await t.test('anonymous browser cannot read identity fields or execute payment RPC', async () => {
    assert.equal((await sql("SET ROLE anon; SELECT name FROM prayer_wall.commitments WHERE name = 'Anonymous' LIMIT 1;")).split('\n').at(-1), 'Anonymous')
    for (const column of ['first_name', 'last_name', 'email']) {
      await assert.rejects(sql(`SET ROLE anon; SELECT ${column} FROM prayer_wall.commitments;`), /permission denied/)
    }
    await assert.rejects(sql(`SET ROLE anon; ${record('pi_browser')}`), /permission denied/)
    await assert.rejects(sql(`SET ROLE authenticated; ${record('pi_browser')}`), /permission denied/)
  })

  await t.test('ordinary prayer commitment insertion still works', async () => {
    await sql(`SET ROLE anon; INSERT INTO prayer_wall.commitments (wall_id, name, email) VALUES ('${prayerWallId}', 'Prayer Donor', 'prayer@example.com') RETURNING id, wall_id, name, committed_at, reminder_active, last_reminded_at;`)
    assert.equal(await sql(`SELECT reminder_active FROM prayer_wall.commitments WHERE wall_id = '${prayerWallId}';`), 't')
  })

  await t.test('migration can be applied again without changing records', async () => {
    await sql(migration)
    assert.equal(await sql('SELECT count(*) FROM prayer_wall.donations;'), '4')
    assert.equal(await sql('SELECT count(*) FROM prayer_wall.commitments;'), '5')
  })

  await t.test('full-name migration backfills linked donations and preserves existing names', async () => {
    const fullNameMigration = await readFile(new URL('../migrations/031_donation_full_name.sql', import.meta.url), 'utf8')
    await sql(fullNameMigration)
    // A table-level REVOKE also removes column SELECT grants. The public wall
    // must retain its exact projection after every migration, not just 030.
    const publicCommitmentRead = 'SET ROLE anon; SELECT id, wall_id, name, committed_at, reminder_active, last_reminded_at FROM prayer_wall.commitments LIMIT 1;'
    await sql(publicCommitmentRead)
    assert.equal(await sql(`SELECT count(*) FROM prayer_wall.commitments c JOIN prayer_wall.donations d ON d.commitment_id = c.id WHERE c.full_name = d.name;`), '4')
    assert.equal(await sql(`SELECT first_name || ' ' || last_name FROM prayer_wall.commitments c JOIN prayer_wall.donations d ON d.commitment_id = c.id WHERE d.processor_ref = 'pi_one';`), 'Mary Jane van der Berg')
    assert.equal(await sql(`SELECT full_name IS NULL FROM prayer_wall.commitments WHERE wall_id = '${prayerWallId}';`), 't')

    const namedRecord = (ref, name = 'The Family') => `SELECT prayer_wall.record_paid_donation(p_wall_id => '${wallId}', p_processor_ref => '${ref}', p_name => '${name}', p_email => 'test@example.com', p_amount_cents => 2500, p_currency => 'usd');`
    const result = JSON.parse((await sql(`SET ROLE service_role; ${namedRecord('pi_full')}`)).split('\n').at(-1))
    assert.equal(result.created, true)
    const row = JSON.parse(await sql(`SELECT row_to_json(r) FROM (
      SELECT c.full_name, c.first_name, c.last_name, d.name, d.amount_cents, d.processor_ref
      FROM prayer_wall.commitments c JOIN prayer_wall.donations d ON d.commitment_id = c.id
      WHERE d.id = '${result.id}'
    ) r;`))
    assert.deepEqual(row, { full_name: 'The Family', first_name: null, last_name: null, name: 'The Family', amount_cents: 2500, processor_ref: 'pi_full' })
    const retries = await Promise.all(Array.from({ length: 4 }, () => sql(namedRecord('pi_full'))))
    for (const retry of retries.map(JSON.parse)) {
      assert.equal(retry.created, false)
      assert.equal(retry.commitment_id, result.commitment_id)
    }

    // The old deployed webhook still works during rollout.
    await sql(record('pi_old_webhook'))
    assert.equal(await sql(`SELECT c.full_name FROM prayer_wall.commitments c JOIN prayer_wall.donations d ON d.commitment_id = c.id WHERE d.processor_ref = 'pi_old_webhook';`), 'Anonymous')
    await assert.rejects(sql(`SET ROLE anon; ${namedRecord('pi_browser_full')}`), /permission denied/)
    await assert.rejects(sql(`SET ROLE authenticated; ${namedRecord('pi_browser_full')}`), /permission denied/)
    await assert.rejects(sql('SET ROLE anon; SELECT full_name FROM prayer_wall.commitments;'), /permission denied/)

    await sql(`CREATE OR REPLACE FUNCTION prayer_wall.reject_test_commitment() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.full_name = 'Reject' THEN RAISE EXCEPTION 'test commitment failure'; END IF;
        RETURN NEW;
      END $$;`)
    await assert.rejects(sql(namedRecord('pi_full_rollback', 'Reject')), /test commitment failure/)
    assert.equal(await sql("SELECT count(*) FROM prayer_wall.donations WHERE processor_ref = 'pi_full_rollback';"), '0')
    const countsBefore = await sql('SELECT (SELECT count(*) FROM prayer_wall.commitments), (SELECT count(*) FROM prayer_wall.donations);')
    await sql(fullNameMigration)
    await sql(publicCommitmentRead)
    assert.equal(await sql('SELECT (SELECT count(*) FROM prayer_wall.commitments), (SELECT count(*) FROM prayer_wall.donations);'), countsBefore)
    assert.equal(await sql(`SELECT full_name FROM prayer_wall.commitments WHERE id = '${result.commitment_id}';`), 'The Family')

    // Reproduce the permissions left by the originally deployed migration 031.
    await sql('REVOKE SELECT ON prayer_wall.commitments FROM PUBLIC, anon;')
    await assert.rejects(sql(publicCommitmentRead), /permission denied/)
    const repair = await readFile(new URL('../migrations/032_restore_commitment_public_reads.sql', import.meta.url), 'utf8')
    await sql(repair)
    await sql(publicCommitmentRead)
    for (const column of ['email', 'first_name', 'last_name', 'full_name']) {
      await assert.rejects(sql(`SET ROLE anon; SELECT ${column} FROM prayer_wall.commitments;`), /permission denied/)
    }
    await sql('SET ROLE authenticated; SELECT email, full_name FROM prayer_wall.commitments LIMIT 1;')
    // Prayer form INSERT ... RETURNING needs the same public read grants.
    await sql(`SET ROLE anon; INSERT INTO prayer_wall.commitments (wall_id, name, email) VALUES ('${prayerWallId}', 'After Repair', 'repair@example.com') RETURNING id, wall_id, name, committed_at, reminder_active, last_reminded_at;`)
    await sql(repair)
    await sql(publicCommitmentRead)
  })
})
