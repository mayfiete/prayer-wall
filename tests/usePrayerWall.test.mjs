import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../src/presentation/hooks/usePrayerWall.ts', import.meta.url), 'utf8')
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
  const container = { getPrayerWall: { execute } }
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
  function render() { cursor = 0; return exports.usePrayerWall(wall) }
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

test('new prayer stones appear first without duplicates', async () => {
  const hook = mount(async () => [{ id: 'older', committedAt: new Date('2026-01-01') }])
  await setImmediate()
  hook.render().addPrayer({ id: 'newest', committedAt: new Date('2026-09-29') })
  hook.render().addPrayer({ id: 'newest', committedAt: new Date('2026-09-29') })
  assert.deepEqual(Array.from(hook.render().prayers, row => row.id), ['newest', 'older'])
})
