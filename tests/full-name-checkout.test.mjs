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

for (const [firstName, lastName, expected] of [
  [' Mary Jane ', ' van der Berg ', 'Mary Jane van der Berg'],
  ['Alex', '', 'Alex'],
  ['', 'Smith', undefined],
]) {
  test(`checkout combines names and requires a first name: first=${JSON.stringify(firstName)}, last=${JSON.stringify(lastName)}`, async () => {
    const app = checkoutHarness()
    let tree = app.render()
    const fields = nodes(tree).filter(n => n.type === 'input-control' && ['given-name', 'family-name'].includes(n.props.autoComplete))
    assert.equal(fields.length, 2)
    assert.equal(fields[0].props.required, true)
    assert.ok(!fields[1].props.required)
    fields[0].props.onChange({ target: { value: firstName } })
    fields[1].props.onChange({ target: { value: lastName } })
    nodes(tree).find(n => n.props?.id === 'monthly-consent').props.onChange({ target: { checked: true } })
    tree = app.render()
    await tree.props.onSubmit({ preventDefault() {} })
    // The event wrapper intentionally discards the promise; drain its async handoff.
    await new Promise(resolve => setImmediate(resolve))
    if (expected === undefined) {
      assert.equal(app.body, undefined)
      assert.equal(app.redirect, undefined)
      assert.ok(nodes(app.render()).some(n => n.props?.children === 'Enter your first name'))
    } else {
      assert.equal(app.body.full_name, expected)
      assert.equal(app.body.monthly_consent, true)
      assert.equal(app.redirect, 'https://checkout.stripe.com/fixture')
    }
  })
}
