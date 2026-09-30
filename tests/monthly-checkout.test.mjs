import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

// Execute the actual form, use case and gateway with browser/React boundaries mocked.
function checkoutHarness() {
  const state = []
  let cursor = 0
  let container
  let body
  let redirect
  const cache = new Map()
  const jsx = (type, props) => ({ type, props })
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const exports = {}
    cache.set(file, exports)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    vm.runInNewContext(code, {
      exports, console: { info() {}, error() {} }, Response,
      window: { location: { origin: 'http://localhost:5173', assign(url) { redirect = url } } },
      require(id) {
        if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
        if (id === 'react') return { useState(initial) {
          const index = cursor++
          if (!(index in state)) state[index] = initial
          return [state[index], (value) => { state[index] = value }]
        } }
        if (id === 'lucide-react') return {}
        if (id.endsWith('/AppContext')) return { useContainer: () => container }
        return load(path.resolve(path.dirname(file), id + '.ts'))
      },
    }, { filename: file })
    return exports
  }
  // Presentational controls are leaves so their props and handlers remain inspectable.
  cache.set(path.resolve('src/presentation/components/ui/Input.ts'), { Input: 'input-control' })
  cache.set(path.resolve('src/presentation/components/ui/Button.ts'), { Button: 'button-control' })
  const { StripeCheckoutGateway } = load(path.resolve('src/infrastructure/gateways/StripeCheckoutGateway.ts'))
  const { StartDonationCheckout } = load(path.resolve('src/application/use-cases/StartDonationCheckout.ts'))
  const gateway = new StripeCheckoutGateway({ functions: { invoke: async (_name, options) => {
    body = options.body
    return { data: { url: 'https://checkout.stripe.com/fixture', session_id: 'cs_fixture' }, error: null }
  } } })
  container = { startDonationCheckout: new StartDonationCheckout(gateway), confirmSimulatedDonation: null }
  const { DonationCheckout } = load(path.resolve('src/presentation/components/DonationCheckout.tsx'))
  return {
    render() { cursor = 0; return DonationCheckout({ givingWallId: 'wall-fixture' }) },
    get body() { return body }, get redirect() { return redirect },
  }
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}

test('monthly checkout requires consent and sends it with the selected amount', async () => {
  const app = checkoutHarness()
  let tree = app.render()
  nodes(tree).find(n => n.props?.id === 'donation-first-name').props.onChange({ target: { value: 'Alex' } })
  tree = app.render()
  await tree.props.onSubmit({ preventDefault() {} })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(app.body, undefined, 'unaccepted consent must block checkout')
  tree = app.render()
  const checkbox = nodes(tree).find(n => n.props?.id === 'monthly-consent')
  assert.ok(checkbox, 'monthly consent checkbox is visible')
  assert.equal(checkbox.props.checked, false)
  checkbox.props.onChange({ target: { checked: true } })
  tree = app.render()
  await tree.props.onSubmit({ preventDefault() {} })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(app.body.monthly_consent, true)
  assert.equal(app.body.amount_cents, 5000)
  assert.equal(app.redirect, 'https://checkout.stripe.com/fixture')
})

test('changing preset or custom amount resets monthly consent', () => {
  const app = checkoutHarness()
  for (const custom of [false, true]) {
    let tree = app.render()
    const checkbox = nodes(tree).find(n => n.props?.id === 'monthly-consent')
    assert.ok(checkbox)
    checkbox.props.onChange({ target: { checked: true } })
    tree = app.render()
    if (custom) nodes(tree).find(n => n.props?.id === 'custom-amount').props.onChange({ target: { value: '75' } })
    else nodes(tree).find(n => n.type === 'button' && n.props['aria-pressed'] === false).props.onClick()
    tree = app.render()
    assert.equal(nodes(tree).find(n => n.props?.id === 'monthly-consent').props.checked, false)
    assert.equal(nodes(tree).find(n => n.type === 'button-control').props.disabled, true)
  }
})
