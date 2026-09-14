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

for (const [name, anonymous, expected] of [
  [' Mary Jane van der Berg ', false, 'Mary Jane van der Berg'],
  ['', false, undefined],
  ['Private Name', true, undefined],
]) {
  test(`one optional Full Name reaches Checkout correctly: anonymous=${anonymous}, blank=${!name}`, async () => {
    const app = checkoutHarness()
    let tree = app.render()
    const fields = nodes(tree).filter(n => n.type === 'input-control' && n.props.autoComplete === 'name')
    assert.equal(fields.length, 1)
    assert.equal(fields[0].props.label, 'Full Name (optional)')
    assert.ok(!fields[0].props.required)
    fields[0].props.onChange({ target: { value: name } })
    if (anonymous) nodes(tree).find(n => n.props?.type === 'checkbox').props.onChange({ target: { checked: true } })
    tree = app.render()
    if (anonymous) assert.equal(nodes(tree).filter(n => n.props?.autoComplete === 'name').length, 0)
    await tree.props.onSubmit({ preventDefault() {} })
    // The event wrapper intentionally discards the promise; drain its async handoff.
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(app.body.full_name, expected)
    assert.equal(app.body.is_anonymous, anonymous)
    assert.equal(app.redirect, 'https://checkout.stripe.com/fixture')
  })
}
