import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../src/presentation/hooks/useGivingWall.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
})

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

// Execute the actual hook with controlled effect lifetimes and network promises.
// No browser, Supabase connection, or real retry delays are needed.
function mount(execute, initialWall = 'wall-a') {
  const state = []
  const timers = new Map()
  let cursor = 0, nextTimer = 0, effect, cleanup, wall = initialWall
  const container = { getGivingWall: { execute } }
  const exports = {}
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = initial
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
    },
    useEffect(setup) { effect = setup },
    useCallback(callback) { return callback },
  }
  vm.runInNewContext(outputText, {
    exports, Error, TypeError,
    console: { error() {}, warn() {} },
    require(name) {
      if (name === 'react') return react
      if (name === '../context/AppContext') return { useContainer: () => container }
      throw new Error(`Unexpected import: ${name}`)
    },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  })
  function render() { cursor = 0; return exports.useGivingWall(wall) }
  function restart(nextWall = wall) {
    cleanup?.()
    wall = nextWall
    render()
    cleanup = effect()
  }
  restart()
  return {
    render, restart,
    unmount() { cleanup?.() },
    timers,
    retry() {
      assert.equal(timers.size, 1, 'exactly one retry should be scheduled')
      const [id, timer] = timers.entries().next().value
      timers.delete(id)
      timer.callback()
    },
  }
}

test('a transient first fetch retries automatically and displays the donation', async () => {
  let attempts = 0
  const donation = { id: 'paid-donation' }
  const hook = mount(async () => {
    if (++attempts === 1) throw new Error('TypeError: Failed to fetch')
    return [donation]
  })
  await setImmediate()
  assert.equal(hook.render().error, null)
  assert.equal(hook.render().loading, true)
  hook.retry()
  await setImmediate()
  assert.equal(attempts, 2)
  assert.equal(hook.render().donations[0], donation)
  assert.equal(hook.render().loading, false)
  assert.equal(hook.render().error, null)
})

test('persistent transport failures stop after three attempts', async () => {
  let attempts = 0
  const hook = mount(async () => { attempts++; throw new TypeError('Failed to fetch') })
  await setImmediate()
  hook.retry()
  await setImmediate()
  hook.retry()
  await setImmediate()
  assert.equal(attempts, 3)
  assert.equal(hook.timers.size, 0)
  assert.ok(hook.render().error)
  assert.equal(hook.render().loading, false)
})

test('permission errors are displayed without retrying', async () => {
  const hook = mount(async () => { throw new Error('permission denied for table donations') })
  await setImmediate()
  assert.equal(hook.timers.size, 0)
  assert.equal(hook.render().error, 'permission denied for table donations')
  assert.equal(hook.render().loading, false)
})

test('an obsolete effect failure cannot hide a newer successful load', async () => {
  const oldRequest = deferred(), newRequest = deferred()
  let attempts = 0
  const hook = mount(() => ++attempts === 1 ? oldRequest.promise : newRequest.promise)
  hook.restart() // setup -> cleanup -> setup, as in development StrictMode
  newRequest.resolve([{ id: 'visible' }])
  await setImmediate()
  oldRequest.reject(new Error('TypeError: Failed to fetch'))
  await setImmediate()
  assert.equal(hook.render().error, null)
  assert.equal(hook.render().donations[0].id, 'visible')
  assert.equal(hook.timers.size, 0)
})

test('changing walls ignores stale results and clears the previous error', async () => {
  const oldRequest = deferred()
  const hook = mount(wall => wall === 'wall-a' ? oldRequest.promise : Promise.resolve([{ id: 'wall-b-donation' }]))
  hook.restart('wall-b')
  await setImmediate()
  oldRequest.resolve([{ id: 'wrong-wall' }])
  await setImmediate()
  assert.equal(hook.render().donations[0].id, 'wall-b-donation')

  const failedHook = mount(async wall => {
    if (wall === 'wall-a') throw new Error('permission denied')
    return [{ id: 'recovered' }]
  })
  await setImmediate()
  failedHook.restart('wall-b')
  assert.equal(failedHook.render().error, null)
  await setImmediate()
  assert.equal(failedHook.render().donations[0].id, 'recovered')
  assert.equal(failedHook.render().error, null)
})

test('cleanup cancels a scheduled retry', async () => {
  const hook = mount(async () => { throw new TypeError('Failed to fetch') })
  await setImmediate()
  assert.equal(hook.timers.size, 1)
  hook.unmount()
  assert.equal(hook.timers.size, 0)
})

test('a realtime donation arriving during the initial load is retained without duplicates', async () => {
  const request = deferred()
  const hook = mount(() => request.promise)
  hook.render().addDonation({ id: 'just-paid' })
  request.resolve([{ id: 'older' }])
  await setImmediate()
  assert.deepEqual(Array.from(hook.render().donations, row => row.id), ['just-paid', 'older'])
  hook.render().addDonation({ id: 'just-paid' })
  assert.equal(hook.render().donations.length, 2)
})
