import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'

const container = process.env.DONATION_ACCESS_TEST_CONTAINER
const apiUrl = process.env.DONATION_ACCESS_TEST_URL ?? 'http://127.0.0.1:54321'
const jwtSecret = process.env.DONATION_ACCESS_TEST_JWT_SECRET
const anonKey = process.env.DONATION_ACCESS_TEST_ANON_KEY
const wallId = '00000000-0000-0000-0000-000000000003'
const publicColumns = 'id, giving_wall_id, name, amount_cents, currency, processor, processor_ref, email_opt_out, donated_at, created_at'
const privateColumns = ['email', 'thank_you_sent', 'commitment_id']

function sql(query) {
  return new Promise((resolve, reject) => {
    const child = execFile('docker', ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message))
      else resolve(stdout.trim())
    })
    child.stdin.end(query)
  })
}

function token(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, iss: 'supabase', exp: Math.floor(Date.now() / 1000) + 3600, sub: '00000000-0000-0000-0000-000000000099' })}`
  return `${payload}.${createHmac('sha256', jwtSecret).update(payload).digest('base64url')}`
}

async function subscribe(client, name) {
  const events = []
  const pending = new Set()
  const channel = client.channel(name).on('postgres_changes', {
    event: '*', schema: 'prayer_wall', table: 'donations', filter: `giving_wall_id=eq.${wallId}`,
  }, (payload) => {
    events.push(payload)
    for (const waiter of pending) {
      if (waiter.matches(payload)) waiter.resolve(payload)
    }
  })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscription timed out')), 20000)
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout)
        resolve()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timeout)
        reject(error ?? new Error(status))
      }
    })
  })
  return (ref, eventType = 'INSERT') => {
    const matches = (payload) => payload.eventType === eventType && payload.new.processor_ref === ref
    const existing = events.find(matches)
    if (existing) return Promise.resolve(existing)
    return new Promise((resolve, reject) => {
      const waiter = { matches, resolve: (payload) => { clearTimeout(timeout); pending.delete(waiter); resolve(payload) } }
      const timeout = setTimeout(() => { pending.delete(waiter); reject(new Error(`Missing Realtime ${eventType}: ${ref}`)) }, 20000)
      pending.add(waiter)
    })
  }
}

test('donation API and Realtime privacy on an empty disposable local Supabase stack', { skip: !container }, async (t) => {
  assert.ok(container.startsWith('supabase_db_'), 'Use a disposable Supabase CLI database container')
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(apiUrl).hostname), 'Never run against a remote API')
  assert.ok(jwtSecret, 'Set DONATION_ACCESS_TEST_JWT_SECRET to the disposable local stack JWT secret')
  assert.ok(anonKey, 'Set DONATION_ACCESS_TEST_ANON_KEY to the disposable local stack anon key')
  const health = await fetch(`${apiUrl}/rest/v1/`, { headers: { apikey: anonKey, Authorization: `Bearer ${token('anon')}` } })
  assert.equal(health.status, 200, 'Local API credentials must work before creating fixtures')
  await health.arrayBuffer()
  assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'prayer_wall';"), '0', 'Use an empty disposable schema, never a real project')

  for (const file of ['001_initial_schema.sql', '009_prayer_warriors.sql', '018_email_logs_type.sql', '019_grant_service_role_schema.sql', '022_giving_wall.sql', '024_fix_donations_grants.sql', '026_giving_wall_stripe.sql']) {
    await sql(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
  }
  await sql(`INSERT INTO prayer_wall.walls (id, org_id, name, slug) VALUES ('${wallId}', '00000000-0000-0000-0000-000000000001', 'Giving Wall', 'giving'); CREATE TABLE prayer_wall.wall_theme (wall_id uuid);`)
  for (const file of ['029_walls_app_type.sql', '030_donation_commitments.sql', '031_donation_full_name.sql', '032_restore_commitment_public_reads.sql']) {
    await sql(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'))
  }

  const clients = Object.fromEntries(['anon', 'authenticated', 'service_role'].map((role) => [role, createClient(apiUrl, anonKey, {
    db: { schema: 'prayer_wall' },
    global: { headers: { Authorization: `Bearer ${token(role)}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })]))
  t.after(async () => { await Promise.all(Object.values(clients).map((client) => client.removeAllChannels())) })
  for (const role of ['anon', 'authenticated']) await clients[role].realtime.setAuth(token(role))
  const subscribers = await Promise.all(['anon', 'authenticated'].map((role) => subscribe(clients[role], `privacy-existing-${role}`)))
  const replicationDeadline = Date.now() + 20000
  while (await sql("SELECT EXISTS (SELECT 1 FROM pg_replication_slots WHERE plugin = 'wal2json');") !== 't') {
    assert.ok(Date.now() < replicationDeadline, 'Realtime logical replication slot did not start')
    await delay(100)
  }
  const record = (ref) => sql(`SET ROLE service_role; SELECT prayer_wall.record_paid_donation(p_wall_id => '${wallId}', p_processor_ref => '${ref}', p_name => 'Anonymous', p_email => 'privacy-fixture@example.com', p_amount_cents => 2500, p_currency => 'usd');`)

  await t.test('reproduces email exposure before migration 033', async () => {
    await record('pi_before_privacy_fix')
    for (const role of ['anon', 'authenticated']) {
      const { data, error } = await clients[role].from('donations').select('email').eq('processor_ref', 'pi_before_privacy_fix').single()
      assert.equal(error, null)
      assert.equal(data.email, 'privacy-fixture@example.com')
    }
    for (const next of subscribers) assert.equal((await next('pi_before_privacy_fix')).new.email, 'privacy-fixture@example.com')
  })

  const repair = await readFile(new URL('../migrations/033_restrict_donation_public_reads.sql', import.meta.url), 'utf8')
  await sql(repair)

  await t.test('API permits public fields but denies private projections, filters and browser writes', async () => {
    for (const role of ['anon', 'authenticated']) {
      const client = clients[role]
      const { data, error } = await client.from('donations').select(publicColumns)
      assert.equal(error, null)
      assert.equal(data.length, 1)
      assert.deepEqual(Object.keys(data[0]).sort(), publicColumns.split(', ').sort())
      for (const column of [...privateColumns, '*']) {
        const result = await client.from('donations').select(column)
        assert.equal(result.error?.code, '42501', `${role} must not select ${column}`)
        assert.equal(result.data, null)
      }
      const filtered = await client.from('donations').select('id').eq('email', 'privacy-fixture@example.com')
      assert.equal(filtered.error?.code, '42501')
      const inserted = await client.from('donations').insert({ giving_wall_id: wallId, name: 'Browser', amount_cents: 100 })
      assert.equal(inserted.error?.code, '42501')
      const updated = await client.from('donations').update({ email: 'changed@example.com' }).eq('processor_ref', 'pi_before_privacy_fix')
      assert.equal(updated.error?.code, '42501')
    }
    const { data, error } = await clients.service_role.from('donations').select('email, thank_you_sent, commitment_id').single()
    assert.equal(error, null)
    assert.equal(data.email, 'privacy-fixture@example.com')
    assert.ok(data.commitment_id)
  })

  await t.test('existing and new Realtime subscriptions receive public INSERT and UPDATE data only', async () => {
    const fresh = await Promise.all(['anon', 'authenticated'].map((role) => subscribe(clients[role], `privacy-new-${role}`)))
    const listeners = [...subscribers, ...fresh]
    await record('pi_after_privacy_fix')
    await sql("SET ROLE service_role; UPDATE prayer_wall.donations SET email = 'updated-private@example.com', thank_you_sent = true WHERE processor_ref = 'pi_after_privacy_fix';")
    for (const next of listeners) {
      for (const eventType of ['INSERT', 'UPDATE']) {
        const event = await next('pi_after_privacy_fix', eventType)
        assert.equal(event.new.name, 'Anonymous')
        assert.deepEqual(Object.keys(event.new).sort(), publicColumns.split(', ').sort())
        for (const column of privateColumns) {
          assert.equal(Object.hasOwn(event.new, column), false)
          assert.equal(Object.hasOwn(event.old, column), false)
        }
        assert.ok(!JSON.stringify(event).includes('@example.com'))
      }
    }
  })
})
