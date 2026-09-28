import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// email-layout.ts imports its copy registry from ./email-copy.ts, and a data:
// URL module cannot resolve relative specifiers, so both files are inlined into
// one module. The re-export lines are dropped because email-copy's own exports
// become exports of the merged module.
const copySource = await readFile(new URL('./_shared/email-copy.ts', import.meta.url), 'utf8')
const layoutSource = await readFile(new URL('./_shared/email-layout.ts', import.meta.url), 'utf8')
const source = `${copySource}\n${
  layoutSource.replace(/^(?:import|export)[^;]*?from\s+"\.\/email-copy\.ts";\r?\n/gm, '')
}`
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
})
const layout = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const logoUrl = 'https://swrcawckpsotialqnisq.supabase.co/storage/v1/object/public/email-assets/hca-logo.png'
const unsubscribeUrl = 'https://example.com/unsubscribe?id=fixture&source=email'

function assertBranding(html) {
  assert.ok(html.includes(`src="${logoUrl}"`))
  assert.match(html, /alt="Heritage Christian Academy"/)
  assert.match(html, /max-width:\s*660px/)
  assert.match(html, /Helvetica Neue.*Helvetica.*Arial/)
  assert.match(html, /#242149/)
  assert.match(html, /#f4f4f4/)
  assert.match(html, /<table[^>]*role="presentation"/)
  assert.match(html, /name="viewport"/)
  assert.doesNotMatch(html, /Georgia|box-shadow|<script|file:\/\/|Prayer Supporters_files/)
}

async function loadEmailModule(name, overrides = {}) {
  const source = await readFile(new URL(`./${name}/index.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source.replace(/^import\s[\s\S]*?;\r?\n/gm, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  })
  let handler
  const context = vm.createContext({
    ...layout,
    Request, Response, URL, Intl,
    console: { log() {}, error() {} },
    Deno: {
      env: { get: (key) => ({ APP_URL: 'https://example.com' })[key] },
      serve: (fn) => { handler = fn },
    },
    fetch: () => { throw new Error('Network calls are disabled in email tests') },
    ...overrides,
  })
  vm.runInContext(outputText, context)
  return { context, handler }
}

test('shared shell uses the HCA newsletter design and preserves body and unsubscribe links', () => {
  const html = layout.emailShell({ title: 'Prayer Guide', bodyHtml: '<p>Our prayer guide</p>', unsubscribeUrl })
  assertBranding(html)
  assert.match(html, /<h1[^>]*>Prayer Guide<\/h1>/)
  assert.ok(html.includes('<p>Our prayer guide</p>'))
  assert.ok(html.includes('href="https://example.com/unsubscribe?id=fixture&amp;source=email"'))
  assert.match(html, /committed to pray/)
})

test('plain-text content cannot inject markup into the template', () => {
  const copy = layout.EMAIL_COPY_DEFAULTS
  const input = '<img src=x onerror="alert(1)"> & Friends'
  const fragments = [
    layout.greeting(copy, input),
    layout.commitmentList(copy, [input]),
    layout.prayerRequestsBlock(copy, [{ categoryName: input, requests: [input] }]),
    layout.personalRequestBlock(copy, input),
    layout.praisesBlock({ ...copy, praises_items: input }),
    layout.passageBlock(copy, { reference: input, translation: input, text: input, copyright: input }),
    layout.closing({ ...copy, closing: input }),
    layout.emailShell({ title: input, eyebrow: input, footerText: input, bodyHtml: '', unsubscribeUrl }),
  ]
  for (const html of fragments) {
    assert.ok(!html.includes(input))
    assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Friends'))
  }
  assert.ok(layout.paragraph('<strong>Psalm 127:1</strong>').includes('<strong>Psalm 127:1</strong>'))
})

test('optional sections remain optional and blank names use the supporter greeting', () => {
  const copy = layout.EMAIL_COPY_DEFAULTS
  assert.equal(layout.commitmentList(copy, []), '')
  assert.equal(layout.prayerRequestsBlock(copy, [{ categoryName: 'Empty', requests: [] }]), '')
  assert.equal(layout.personalRequestBlock(copy, '  '), '')
  assert.equal(layout.praisesBlock({ ...copy, praises_items: '' }), '')
  assert.match(layout.praisesBlock(copy), /Praises/)
  assert.equal(layout.passageBlock(copy, null), '')
  assert.match(layout.greeting(copy, '  '), /Dear Prayer Foundation Supporter,/)
})

test('stored copy rows merge over defaults and blank values fall back', () => {
  const merged = layout.mergeEmailCopy([
    { copy_key: 'donation_subject', value: 'Custom subject' },
    { copy_key: 'greeting', value: '' },
    { copy_key: 'removed_key', value: 'x' },
    { copy_key: 'praises_items', value: '' },
  ])
  assert.equal(merged.donation_subject, 'Custom subject')
  assert.equal(merged.greeting, layout.EMAIL_COPY_DEFAULTS.greeting)
  assert.equal(merged.praises_items, '')
})

test('confirmation and prayer guide both use the shared design', async () => {
  const { context } = await loadEmailModule('send-confirmation')
  const copy = layout.EMAIL_COPY_DEFAULTS
  const commitment = { name: 'Alex & Family' }
  const confirmation = context.buildConfirmationHtml(copy, commitment, unsubscribeUrl)
  assertBranding(confirmation)
  assert.match(confirmation, /Welcome to the Prayer Foundation/)
  assert.match(confirmation, /Dear Alex &amp; Family,/)
  const guide = context.buildSummaryHtml(copy, commitment, [{ id: 'school', name: 'School & Staff' }],
    new Map([['school', ['Wisdom for teachers']]]), unsubscribeUrl)
  assertBranding(guide)
  assert.match(guide, /Your Prayer Guide/)
  assert.match(guide, /School &amp; Staff/)
  assert.match(guide, /Wisdom for teachers/)
  const emptyGuide = context.buildSummaryHtml(copy, commitment, [], new Map(), unsubscribeUrl)
  assertBranding(emptyGuide)
  assert.match(emptyGuide, /No prayer requests are available/)
})

test('reminders keep personal requests, categories, and optional passages within the shared design', async () => {
  const { context } = await loadEmailModule('send-reminders')
  const copy = layout.EMAIL_COPY_DEFAULTS
  const reminder = context.buildEmailHtml(copy, { name: 'Alex', prayer_request: 'Family & friends' }, [],
    [{ categoryName: 'School', bodies: ['Wisdom for teachers'] }], null, unsubscribeUrl)
  assertBranding(reminder)
  assert.match(reminder, /A Prayer Reminder/)
  assert.match(reminder, /Family &amp; friends/)
  assert.match(reminder, /Wisdom for teachers/)
  assert.doesNotMatch(reminder, /A Word for Your Prayers/)
  const withPoints = context.buildEmailHtml(copy, { name: 'Alex', prayer_request: 'Legacy request' },
    [{ body: 'Current request', is_answered: false }, { body: 'Answered request', is_answered: true }], [],
    { reference: 'Psalm 127:1', translation: 'KJV', text: 'Except the LORD build the house', copyright: null }, unsubscribeUrl)
  assertBranding(withPoints)
  assert.match(withPoints, /Current request/)
  assert.match(withPoints, /Except the LORD build the house/)
  assert.doesNotMatch(withPoints, /Legacy request|Answered request/)
})

test('donation thank-you keeps the amount and donation link with Giving Wall branding', async () => {
  let email
  const donationId = '00000000-0000-0000-0000-000000000001'
  const donation = { id: donationId, giving_wall_id: '00000000-0000-0000-0000-000000000002',
    name: 'Alex & Family', amount_cents: 2500, currency: 'usd', email: 'test@example.com', thank_you_sent: false }
  const db = {
    schema: () => db,
    from: (table) => table === 'donations' ? {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: donation }) }) }),
      insert: async () => ({}),
      update: () => ({ eq: async () => ({}) }),
    } : {
      // email_copy: one stored override — the subject must reach Resend
      select: () => ({ eq: async () => ({ data: [{ copy_key: 'donation_subject', value: 'A custom subject' }], error: null }) }),
      insert: async () => ({}),
    },
  }
  const { handler } = await loadEmailModule('send-donation-thanks', {
    createClient: () => db,
    fetch: async (url, init) => {
      assert.equal(url, 'https://api.resend.com/emails')
      email = JSON.parse(init.body)
      return Response.json({ id: 'mock-email' })
    },
  })
  const response = await handler(new Request('http://localhost/send-donation-thanks', {
    method: 'POST', body: JSON.stringify({ donation_id: donationId }),
  }))
  assert.equal(response.status, 200)
  assert.equal(email.subject, 'A custom subject')
  assertBranding(email.html)
  assert.match(email.html, /Dear Alex &amp; Family,/)
  assert.match(email.html, /\$25\.00/)
  assert.match(email.html, /HCA Fredericksburg · Giving Wall/)
  assert.match(email.html, /because you made a gift/)
  assert.doesNotMatch(email.html, /committed to pray|Prayer Foundation/)
  assert.ok(email.html.includes(`/unsubscribe?donation=${donationId}`))
})
