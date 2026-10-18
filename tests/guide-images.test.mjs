import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function harness() {
  const state = []
  let cursor = 0
  let value = ''
  let pending
  const uploads = []
  const exports = {}
  const jsx = (type, props) => ({ type, props })
  const code = ts.transpileModule(readFileSync('src/presentation/pages/admin/GuideImagesEditor.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, crypto: { randomUUID: () => `image-${uploads.length}` }, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id === 'react') return { useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = initial
      return [state[index], next => { state[index] = next }]
    } }
    throw new Error(`Unexpected import: ${id}`)
  } })
  const supabase = { storage: { from(bucket) {
    assert.equal(bucket, 'wall-assets')
    return {
      upload: async (path, file) => { uploads.push({ path, file }); return { error: null } },
      getPublicUrl: path => ({ data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/wall-assets/${path}` } }),
    }
  } } }
  return {
    uploads,
    get value() { return value },
    render() {
      cursor = 0
      return exports.GuideImagesEditor({ supabase, wallId: 'wall', value, onChange: next => { value = next }, onBusy: busy => { pending = busy } })
    },
    async upload(files) {
      nodes(this.render()).find(n => n.type === 'input').props.onChange({ target: { files, value: '' } })
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(pending, false)
    },
  }
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  return [tree, ...nodes(tree.props?.children)]
}

test('admin uploads two images to Storage, reorders and removes them from the guide', async () => {
  const app = harness()
  await app.upload([{ type: 'image/png', size: 20 }, { type: 'image/jpeg', size: 30 }])
  assert.equal(app.uploads.length, 2)
  assert.match(app.uploads[0].path, /^wall\/prayer-guide\/image-0\.png$/)
  const original = app.value.split('\n')
  const previews = nodes(app.render()).filter(n => n.type === 'img')
  assert.equal(previews.length, 2)
  assert.equal(previews[0].props.src, original[0])
  nodes(app.render()).find(n => n.type === 'button' && n.props.children === 'Move down').props.onClick()
  assert.equal(app.value, `${original[1]}\n${original[0]}`)
  nodes(app.render()).find(n => n.type === 'button' && n.props.children === 'Remove').props.onClick()
  assert.equal(app.value, original[0])
})

test('unsupported and oversized files do not reach Storage', () => {
  for (const file of [{ type: 'image/svg+xml', size: 10 }, { type: 'image/png', size: 16 * 1024 * 1024 }]) {
    const app = harness()
    nodes(app.render()).find(n => n.type === 'input').props.onChange({ target: { files: [file], value: '' } })
    assert.equal(app.uploads.length, 0)
    assert.ok(nodes(app.render()).some(n => n.props?.role === 'alert'))
  }
})
