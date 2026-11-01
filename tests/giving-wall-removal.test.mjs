import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}

async function mount({ confirmed = true, result = { data: true, error: null } } = {}) {
  const state = [], calls = []
  let cursor = 0, effect
  const exports = {}
  const jsx = (type, props) => ({ type, props })
  const source = readFileSync('src/presentation/pages/admin/GivingWallDonorsAdmin.tsx', 'utf8')
    .replace('import.meta.env.VITE_GIVING_WALL_ID', '"wall-fixture"')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, {
    exports, Error, confirm: () => confirmed,
    require(id) {
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (id === 'lucide-react') return { Loader2: 'spinner' }
      if (id === 'react') return {
        useEffect(callback) { effect = callback },
        useState(initial) {
          const index = cursor++
          if (!(index in state)) state[index] = initial
          return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
        },
      }
      throw new Error(`Unexpected import: ${id}`)
    },
  })
  const supabase = { rpc: async (name, args) => {
    if (name === 'admin_read_donations') return { data: [
      { id: 'one', name: 'Alex', amount_cents: 1000, currency: 'usd', donated_at: '2026-01-01', hidden_from_wall: false },
      { id: 'two', name: 'Sam', amount_cents: 2000, currency: 'usd', donated_at: '2026-01-01', hidden_from_wall: false },
    ], error: null }
    calls.push({ name, args })
    return result
  } }
  const render = () => { cursor = 0; return exports.GivingWallDonorsAdmin({ supabase }) }
  render()
  effect()
  await setImmediate()
  return { render, calls, remove() {
    nodes(render()).find(node => node.props?.['aria-label'] === 'Remove Alex from the giving wall').props.onClick()
  } }
}

test('confirmed removal hides only the selected bricklayer and retains donation totals', async () => {
  const app = await mount()
  app.remove()
  await setImmediate()
  assert.equal(app.calls.length, 1)
  assert.equal(app.calls[0].name, 'admin_hide_donation')
  assert.equal(app.calls[0].args.p_wall_id, 'wall-fixture')
  assert.equal(app.calls[0].args.p_donation_id, 'one')
  const tree = nodes(app.render())
  assert.ok(tree.some(node => node.props?.children === 'Hidden'))
  assert.ok(tree.some(node => node.props?.['aria-label'] === 'Remove Sam from the giving wall'))
  assert.equal(tree.filter(node => node.type === 'tbody')[0].props.children.length, 2)
  assert.ok(tree.some(node => Array.isArray(node.props?.children) && node.props.children.includes('$30.00')))
})

test('cancelling removal does not call the mutation RPC', async () => {
  const app = await mount({ confirmed: false })
  app.remove()
  await setImmediate()
  assert.equal(app.calls.length, 0)
})

for (const result of [{ data: null, error: { message: 'Administrator access required' } }, { data: false, error: null }]) {
  test(`failed removal keeps the row visible and retryable: ${JSON.stringify(result)}`, async () => {
    const app = await mount({ result })
    app.remove()
    await setImmediate()
    const tree = nodes(app.render())
    assert.ok(tree.some(node => node.props?.role === 'alert'))
    assert.equal(tree.find(node => node.props?.['aria-label'] === 'Remove Alex from the giving wall').props.disabled, false)
    assert.equal(tree.some(node => node.props?.children === 'Hidden'), false)
  })
}
