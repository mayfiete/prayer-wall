import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

// Exercise the real grid and theme with only React/DOM lifecycle boundaries mocked.
function mount(initialWidth = 1440, theme = {}, loading = false) {
  let width = initialWidth, cursor = 0
  const slots = [], effects = [], cleanups = [], resizeCallbacks = new Set(), mutations = new Set()
  const properties = new Map()
  const root = { style: { setProperty(key, value) { properties.set(key, value) } } }
  const element = { get clientWidth() { return width }, getBoundingClientRect: () => ({ width }) }
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useMemo: fn => fn(),
    useCallback: fn => fn,
    useEffect(fn) { effects.push(fn) },
    useLayoutEffect(fn) { effects.push(fn) },
    Fragment: 'fragment',
  }
  const jsx = (type, props) => {
    if (props.ref) props.ref.current = element
    return { type, props }
  }
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file)
    const exports = {}
    cache.set(file, exports)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    vm.runInNewContext(code, {
      exports, document: { documentElement: root }, window: { innerWidth: initialWidth },
      getComputedStyle: () => ({
        getPropertyValue: key => properties.get(key) ?? '', paddingLeft: '20px', paddingRight: '20px',
      }),
      ResizeObserver: class {
        constructor(callback) { this.callback = callback }
        observe() { resizeCallbacks.add(this.callback) }
        disconnect() { resizeCallbacks.delete(this.callback) }
      },
      MutationObserver: class {
        constructor(callback) { this.callback = callback }
        observe() { mutations.add(this.callback) }
        disconnect() { mutations.delete(this.callback) }
      },
      require(id) {
        if (id === 'react') return react
        if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
        if (id === 'lucide-react') return { Loader2: 'loader' }
        return load(path.resolve(path.dirname(file), id + '.ts'))
      },
    }, { filename: file })
    return exports
  }
  const { applyTheme } = load(path.resolve('src/infrastructure/theme.ts'))
  applyTheme(theme)
  const { WallGrid } = load(path.resolve('src/presentation/components/WallGrid.tsx'))
  const props = { items: Array.from({ length: 20 }, (_, i) => ({ key: `person-${i}`, node: `Person ${i}` })), ctaBrick: 'Join', loading, error: null }
  function render() { cursor = 0; effects.length = 0; return WallGrid(props) }
  render()
  effects.forEach(fn => cleanups.push(fn()))
  return {
    render,
    resize(next) { width = next; resizeCallbacks.forEach(fn => fn([])) },
    theme(next) { applyTheme(next); mutations.forEach(fn => fn([])) },
    loaded() { props.loading = false },
    unmount() { cleanups.forEach(fn => fn?.()) },
    get observerCount() { return resizeCallbacks.size + mutations.size },
  }
}

function wall(tree) {
  if (tree?.props?.className === 'stone-wall') return tree
  const children = tree?.props?.children
  return (Array.isArray(children) ? children : [children]).filter(Boolean).map(wall).find(Boolean)
}
const rows = tree => wall(tree).props.children
const count = tree => rows(tree)[0].props.children.length

test('both walls reflow on container resize and restore the configured desktop maximum', () => {
  const app = mount()
  assert.equal(count(app.render()), 5)
  app.resize(390)
  assert.ok(count(app.render()) < 5, 'phone layout must use fewer columns')
  const content = rows(app.render()).flatMap(row => row.props.children.map(item => item.props.children))
  assert.deepEqual(Array.from(content), ['Join', ...Array.from({ length: 20 }, (_, i) => `Person ${i}`)])
  app.resize(1440)
  assert.equal(count(app.render()), 5)
})

test('single-column walls do not offset alternate rows off screen', () => {
  const app = mount(320, { stones_per_row: 1, brick_scale: 2 })
  assert.equal(count(app.render()), 1)
  assert.ok(rows(app.render()).every(row => !row.props.className.includes('--offset')))
})

test('resizing while data loads is reflected when the wall appears', () => {
  const app = mount(1440, {}, true)
  app.resize(320)
  app.loaded()
  assert.ok(count(app.render()) < 5)
})

test('live theme changes update the layout and observers are cleaned up', () => {
  const app = mount()
  app.theme({ stones_per_row: 3 })
  assert.equal(count(app.render()), 3)
  app.unmount()
  assert.equal(app.observerCount, 0)
})

test('rows fit phone, tablet and desktop widths with default and extreme theme settings', () => {
  for (const theme of [{}, { stones_per_row: 10, brick_scale: 2, brick_overlap_x: 300, brick_overlap_y: 300, brick_aspect: 0.3 }]) {
    const app = mount(1440, theme)
    for (const width of [320, 390, 768, 1024, 1440, 2560, 320]) {
      app.resize(width)
      const tree = app.render()
      const style = wall(tree).props.style
      const stoneWidth = parseFloat(style['--stone-w'])
      const height = parseFloat(style['--stone-h'])
      const overlapX = parseFloat(style['--stone-overlap-x'])
      const overlapY = parseFloat(style['--stone-overlap-y'])
      assert.ok(stoneWidth > overlapX, 'columns must advance horizontally')
      assert.ok(height > overlapY, 'rows must advance vertically')
      for (const row of rows(tree)) {
        const length = row.props.children.length
        const offset = row.props.className.includes('--offset') ? (stoneWidth - overlapX) / 2 : 0
        const right = offset + stoneWidth + (length - 1) * (stoneWidth - overlapX)
        assert.ok(right <= width - 40, `row exceeds available space at ${width}px`)
      }
    }
    app.unmount()
  }
})
