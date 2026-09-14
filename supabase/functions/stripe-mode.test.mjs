import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const wallId = '00000000-0000-0000-0000-000000000003'

async function loadHandler(name, env, sessionMode, options = {}) {
  const source = await readFile(new URL(`./${name}/index.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source.replace(/^import .*;\r?$/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  })
  const calls = { stripe: 0, database: 0, donations: 0, commitments: 0, emails: 0, rpc: [], checkout: null }
  const audits = new Map()
  const donations = new Map()
  let handler
  vm.runInNewContext(outputText, {
    Request, Response, URL, URLSearchParams, TextEncoder, Uint8Array, crypto,
    console: { log() {}, warn() {}, error() {} },
    EdgeRuntime: { waitUntil() {} },
    Deno: { env: { get: (key) => env[key] }, serve: (fn) => { handler = fn } },
    fetch: async (_url, init) => {
      calls.stripe++
      calls.checkout = init.body
      return Response.json({ id: 'cs_fixture', url: 'https://checkout.stripe.com/fixture', livemode: sessionMode })
    },
    createClient: () => {
      calls.database++
      const db = {
        schema: () => db,
        from: (table) => ({
          insert: (row) => {
            if (table === 'webhook_events') {
              if (audits.has(row.processor_event_id)) return { error: { code: '23505' } }
              audits.set(row.processor_event_id, row)
            }
            if (table === 'donations') calls.donations++
            return { error: null, select: () => ({ single: async () => ({ data: { id: 'donation_fixture' }, error: null }) }) }
          },
          update: (row) => ({ eq: async (_column, id) => {
            if (table === 'webhook_events') Object.assign(audits.get(id), row)
            return { error: null }
          } }),
          select: () => ({ eq: (_column, id) => ({ maybeSingle: async () => ({ data: table === 'webhook_events' ? audits.get(id) : null }) }) }),
        }),
        rpc: async (name, args) => {
          assert.equal(name, 'record_paid_donation')
          calls.rpc.push(args)
          if (options.failOnce && calls.rpc.length === 1) return { data: null, error: { message: 'Transient database failure' } }
          const existing = donations.get(args.p_processor_ref)
          if (existing) return { data: { ...existing, created: false }, error: null }
          calls.donations++
          calls.commitments++
          const row = { id: 'donation_fixture', commitment_id: 'commitment_fixture', created: true }
          donations.set(args.p_processor_ref, row)
          return { data: row, error: null }
        },
        functions: { invoke: async () => { calls.emails++ } },
      }
      return db
    },
  })
  return { handler, calls }
}

function checkoutRequest() {
  return new Request('http://localhost/checkout', {
    method: 'POST',
    body: JSON.stringify({ giving_wall_id: wallId, amount_cents: 100, currency: 'usd' }),
  })
}

for (const [label, mode, key, expectedStatus] of [
  ['defaults to test and blocks live keys', undefined, 'sk_live_fixture', 500],
  ['defaults to test and accepts test keys', undefined, 'sk_test_fixture', 200],
  ['explicit test accepts test keys', 'test', 'sk_test_fixture', 200],
  ['explicit test rejects live keys', 'test', 'sk_live_fixture', 500],
  ['explicit live accepts live keys', 'live', 'sk_live_fixture', 200],
  ['explicit live rejects test keys', 'live', 'sk_test_fixture', 500],
  ['accepts restricted test keys', 'test', 'rk_test_fixture', 200],
  ['accepts restricted live keys', 'live', 'rk_live_fixture', 200],
  ['rejects restricted live keys in test', 'test', 'rk_live_fixture', 500],
  ['rejects publishable keys', 'test', 'pk_test_fixture', 500],
  ['rejects unknown mode', 'production', 'sk_live_fixture', 500],
  ['rejects empty mode', '', 'sk_test_fixture', 500],
  ['rejects missing key', 'test', undefined, 500],
]) {
  test(`checkout ${label}`, async () => {
    const { handler, calls } = await loadHandler('create-donation-checkout', {
      STRIPE_MODE: mode, STRIPE_SECRET_KEY: key, GIVING_WALL_ID: wallId,
    }, mode === 'live')
    const response = await handler(checkoutRequest())
    assert.equal(response.status, expectedStatus)
    assert.equal(calls.stripe, expectedStatus === 200 ? 1 : 0)
    if (expectedStatus !== 200 && key) assert.ok(!(await response.text()).includes(key))
  })
}

for (const returnedMode of [true, undefined]) {
  test(`checkout rejects unexpected session livemode=${returnedMode}`, async () => {
    const { handler, calls } = await loadHandler('create-donation-checkout', {
      STRIPE_SECRET_KEY: 'sk_test_fixture', GIVING_WALL_ID: wallId,
    }, returnedMode)
    const response = await handler(checkoutRequest())
    assert.equal(response.status, 502)
    assert.equal(calls.stripe, 1)
    assert.equal((await response.json()).url, undefined)
  })
}

async function webhookRequest(eventMode, sessionMode, validSignature = true, session = {}, event = {}) {
  const body = JSON.stringify({
    id: 'evt_fixture', type: 'checkout.session.completed', livemode: eventMode, ...event,
    data: { object: {
      id: 'cs_fixture', livemode: sessionMode, payment_intent: 'pi_fixture', payment_status: 'paid',
      amount_total: 100, currency: 'usd', customer_details: { name: 'Test Donor', email: 'test@example.com' },
      metadata: { giving_wall_id: wallId }, ...session,
    } },
  })
  const timestamp = Math.floor(Date.now() / 1000)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('whsec_fixture'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`))).toString('hex')
  return new Request('http://localhost/webhook', {
    method: 'POST', body,
    headers: { 'stripe-signature': `t=${timestamp},v1=${validSignature ? signature : 'invalid'}` },
  })
}

for (const [label, mode, eventMode, sessionMode, expectedStatus] of [
  ['defaults to test and blocks live events', undefined, true, true, 400],
  ['defaults to test and accepts test events', undefined, false, false, 200],
  ['accepts explicit test events', 'test', false, false, 200],
  ['accepts explicit live events', 'live', true, true, 200],
  ['rejects test events in live mode', 'live', false, false, 400],
  ['rejects missing event mode', 'test', undefined, false, 400],
  ['rejects mismatched session mode', 'test', false, true, 400],
  ['rejects missing session mode', 'test', false, undefined, 400],
  ['rejects unknown configured mode', 'production', true, true, 500],
  ['rejects empty configured mode', '', false, false, 500],
]) {
  test(`webhook ${label}`, async () => {
    const { handler, calls } = await loadHandler('giving-wall-webhook', {
      STRIPE_MODE: mode, STRIPE_WEBHOOK_SECRET: 'whsec_fixture', GIVING_WALL_ID: wallId,
      SUPABASE_URL: 'http://localhost', SUPABASE_SERVICE_ROLE_KEY: 'fixture',
    })
    const response = await handler(await webhookRequest(eventMode, sessionMode))
    assert.equal(response.status, expectedStatus)
    assert.equal(calls.donations, expectedStatus === 200 ? 1 : 0)
    assert.equal(calls.emails, expectedStatus === 200 ? 1 : 0)
    if (expectedStatus !== 200) assert.equal(calls.database, 0)
  })
}

const webhookEnv = { STRIPE_WEBHOOK_SECRET: 'whsec_fixture', GIVING_WALL_ID: wallId }
const donorFields = [
  { key: 'firstname', text: { value: ' Mary Jane ' } },
  { key: 'lastname', text: { value: ' van der Berg ' } },
]

for (const anonymous of [false, true]) {
  test(`checkout carries the pre-checkout Full Name without extra name fields, anonymous=${anonymous}`, async () => {
    const { handler, calls } = await loadHandler('create-donation-checkout', {
      STRIPE_SECRET_KEY: 'sk_test_fixture', GIVING_WALL_ID: wallId,
    }, false)
    await handler(new Request('http://localhost/checkout', {
      method: 'POST', body: JSON.stringify({ amount_cents: 100, is_anonymous: anonymous, full_name: ' Mary Jane van der Berg ' }),
    }))
    const params = calls.checkout
    const fields = [0, 1, 2].map((i) => ({ key: params.get(`custom_fields[${i}][key]`), optional: params.get(`custom_fields[${i}][optional]`) }))
    const configuredFields = fields.filter((f) => f.key !== null)
    assert.equal(configuredFields.length, 0)
    assert.equal(params.get('metadata[full_name]'), anonymous ? null : 'Mary Jane van der Berg')
  })

  test(`paid webhook saves one wall name, anonymous=${anonymous}`, async () => {
    const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
    const response = await handler(await webhookRequest(false, false, true, {
      custom_fields: [{ key: 'wallname', text: { value: ' The Family ' } }],
      metadata: { giving_wall_id: wallId, is_anonymous: String(anonymous) },
    }))
    assert.equal(response.status, 200)
    assert.equal(calls.commitments, 1)
    assert.equal('p_first_name' in calls.rpc[0], false)
    assert.equal('p_last_name' in calls.rpc[0], false)
    assert.equal(calls.rpc[0].p_name, anonymous ? 'Anonymous' : 'The Family')
    assert.equal(calls.rpc[0].p_wall_id, wallId)
    assert.equal(calls.rpc[0].p_email, 'test@example.com')
    assert.equal((await response.json()).commitment_id, 'commitment_fixture')
  })
}

for (const full_name of [42, {}, 'x'.repeat(101)]) {
  test(`checkout rejects invalid Full Name ${JSON.stringify(full_name)}`, async () => {
    const { handler, calls } = await loadHandler('create-donation-checkout', {
      STRIPE_SECRET_KEY: 'sk_test_fixture', GIVING_WALL_ID: wallId,
    }, false)
    const response = await handler(new Request('http://localhost/checkout', {
      method: 'POST', body: JSON.stringify({ amount_cents: 100, full_name }),
    }))
    assert.equal(response.status, 400)
    assert.equal(calls.stripe, 0)
  })
}

for (const anonymous of [false, true]) {
  test(`webhook persists pre-checkout Full Name, anonymous=${anonymous}`, async () => {
    const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
    const response = await handler(await webhookRequest(false, false, true, {
      metadata: { giving_wall_id: wallId, is_anonymous: String(anonymous), full_name: ' The Smith Family ' },
      custom_fields: donorFields,
    }))
    assert.equal(response.status, 200)
    assert.equal(calls.rpc[0].p_name, anonymous ? 'Anonymous' : 'The Smith Family')
    assert.equal('p_first_name' in calls.rpc[0], false)
    assert.equal('p_last_name' in calls.rpc[0], false)
  })
}

test('legacy checkout uses the captured billing name when custom names are absent', async () => {
  const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
  await handler(await webhookRequest(false, false))
  assert.equal(calls.rpc[0]?.p_name, 'Test Donor')
})

test('wall display override wins over legacy separate names', async () => {
  const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
  await handler(await webhookRequest(false, false, true, {
    custom_fields: [...donorFields, { key: 'wallname', text: { value: 'The Family' } }],
  }))
  assert.equal(calls.rpc[0]?.p_name, 'The Family')
  assert.equal('p_first_name' in calls.rpc[0], false)
})

test('webhook accepts legacy underscored custom-field keys', async () => {
  const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
  const response = await handler(await webhookRequest(false, false, true, {
    custom_fields: [
      { key: 'first_name', text: { value: ' Mary Jane ' } },
      { key: 'last_name', text: { value: ' van der Berg ' } },
      { key: 'wall_name', text: { value: ' The Family ' } },
    ],
  }))
  assert.equal(response.status, 200)
  assert.equal(calls.rpc[0]?.p_name, 'The Family')
  assert.equal('p_first_name' in calls.rpc[0], false)
  assert.equal('p_last_name' in calls.rpc[0], false)
})

for (const [label, session, expected] of [
  ['blank pre-checkout Full Name', { metadata: { giving_wall_id: wallId, full_name: '   ' } }, 'Test Donor'],
  ['blank wall name', { custom_fields: [{ key: 'wallname', text: { value: '   ' } }] }, 'Test Donor'],
  ['compound billing name', { customer_details: { name: 'Mary Jane van der Berg', email: 'test@example.com' } }, 'Mary Jane van der Berg'],
  ['missing names', { customer_details: null }, 'Anonymous'],
  ['legacy separate names', { custom_fields: donorFields }, 'Mary Jane van der Berg'],
]) {
  test(`full wall name fallback: ${label}`, async () => {
    const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
    assert.equal((await handler(await webhookRequest(false, false, true, session))).status, 200)
    assert.equal(calls.rpc[0].p_name, expected)
    assert.equal('p_first_name' in calls.rpc[0], false)
    assert.equal('p_last_name' in calls.rpc[0], false)
  })
}

for (const metadata of [undefined, {}, { giving_wall_id: '00000000-0000-0000-0000-000000000099' }]) {
  test(`rejects missing or wrong wall metadata ${JSON.stringify(metadata)}`, async () => {
    const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
    const response = await handler(await webhookRequest(false, false, true, { metadata }))
    assert.equal(response.status, 400)
    assert.equal(calls.donations, 0)
    assert.equal(calls.commitments, 0)
  })
}

for (const amount_total of [null, 0, -100, 1.5]) {
  test(`rejects invalid paid amount ${amount_total}`, async () => {
    const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
    assert.equal((await handler(await webhookRequest(false, false, true, { amount_total }))).status, 400)
    assert.equal(calls.rpc.length, 0)
  })
}

test('duplicate events and different events for one payment create only one brick and commitment', async () => {
  const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
  for (const id of ['evt_fixture', 'evt_fixture', 'evt_second']) {
    assert.equal((await handler(await webhookRequest(false, false, true, {}, { id }))).status, 200)
  }
  assert.equal(calls.donations, 1)
  assert.equal(calls.commitments, 1)
  assert.equal(calls.emails, 1)
})

test('a failed audited event can retry and persist both records', async () => {
  const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv, false, { failOnce: true })
  assert.equal((await handler(await webhookRequest(false, false))).status, 500)
  assert.equal(calls.donations, 0)
  assert.equal(calls.commitments, 0)
  assert.equal((await handler(await webhookRequest(false, false))).status, 200)
  assert.equal(calls.donations, 1)
  assert.equal(calls.commitments, 1)
})

test('unpaid events do not create records; async success creates both', async () => {
  const { handler, calls } = await loadHandler('giving-wall-webhook', webhookEnv)
  await handler(await webhookRequest(false, false, true, { payment_status: 'unpaid' }))
  assert.equal(calls.rpc.length, 0)
  await handler(await webhookRequest(false, false, true, {}, { id: 'evt_async', type: 'checkout.session.async_payment_succeeded' }))
  assert.equal(calls.donations, 1)
  assert.equal(calls.commitments, 1)
})

test('webhook still rejects invalid signatures before any database access', async () => {
  const { handler, calls } = await loadHandler('giving-wall-webhook', {
    STRIPE_WEBHOOK_SECRET: 'whsec_fixture', GIVING_WALL_ID: wallId,
  })
  const response = await handler(await webhookRequest(false, false, false))
  assert.equal(response.status, 401)
  assert.equal(calls.database, 0)
})
