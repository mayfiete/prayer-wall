import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

// Only the browser lifecycle boundary is replaced; run the real Modal effect.
function mount(open) {
  let effect, cleanup, closed = 0
  const body = { style: { overflow: 'auto' } }
  const dialog = { open: false, showModal() { this.open = true }, close() { this.open = false } }
  const exports = {}
  const jsx = (type, props) => {
    if (props.ref) props.ref.current = dialog
    return { type, props }
  }
  vm.runInNewContext(ts.transpileModule(readFileSync('src/presentation/components/ui/Modal.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, document: { body, addEventListener() {}, removeEventListener() {} },
    require(id) {
      if (id === 'react') return { useEffect(fn) { effect = fn }, useRef: () => ({ current: null }), useId: () => 'dialog-title' }
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (id === 'lucide-react') return { X: 'close-icon' }
      throw new Error(id)
    },
  })
  const tree = exports.Modal({ open, onClose() { closed++ }, title: 'Commit to pray', children: 'Form' })
  cleanup = effect()
  return { tree, body, dialog, unmount: () => cleanup?.(), get closed() { return closed } }
}

test('opening a modal locks the page and cleanup restores its previous scroll style', () => {
  const app = mount(true)
  assert.equal(app.body.style.overflow, 'hidden')
  assert.equal(app.dialog.open, true)
  app.unmount()
  assert.equal(app.body.style.overflow, 'auto')
  assert.equal(app.dialog.open, false)
})

test('a closed modal leaves page scrolling alone', () => {
  const app = mount(false)
  assert.equal(app.tree, null)
  assert.equal(app.body.style.overflow, 'auto')
  app.unmount()
  assert.equal(app.body.style.overflow, 'auto')
})
