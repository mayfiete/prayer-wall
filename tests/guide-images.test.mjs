import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function loadClass(file, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { exports, Error, ...globals })
  return exports
}

function harness({ failAt } = {}) {
  const state = []
  let cursor = 0
  let value = ''
  let pending
  const uploads = []
  let container
  const exports = {}
  const jsx = (type, props) => ({ type, props })
  const code = ts.transpileModule(readFileSync('src/presentation/pages/admin/GuideImagesEditor.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  vm.runInNewContext(code, { exports, Error, crypto: { randomUUID: () => `image-${uploads.length}` }, require(id) {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx }
    if (id.endsWith('/AppContext')) return { useContainer: () => container }
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
      upload: async (path, file) => {
        if (uploads.length === failAt) return { error: { message: 'Storage unavailable' } }
        uploads.push({ path, file })
        return { error: null }
      },
      getPublicUrl: path => ({ data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/wall-assets/${path}` } }),
    }
  } } }
  const { UploadGuideImage } = loadClass('src/application/use-cases/UploadGuideImage.ts', { crypto: { randomUUID: () => `image-${uploads.length}` } })
  const { SupabaseGuideImageStorage } = loadClass('src/infrastructure/gateways/SupabaseGuideImageStorage.ts')
  container = { uploadGuideImage: new UploadGuideImage(new SupabaseGuideImageStorage(supabase)) }
  return {
    uploads,
    get value() { return value },
    render() {
      cursor = 0
      return exports.GuideImagesEditor({ wallId: 'wall', value, onChange: next => { value = next }, onBusy: busy => { pending = busy } })
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

test('a failed second upload preserves the first image and releases the editor', async () => {
  const app = harness({ failAt: 1 })
  await app.upload([{ type: 'image/png', size: 20 }, { type: 'image/jpeg', size: 30 }])
  assert.equal(app.uploads.length, 1)
  assert.match(app.value, /image-0\.png$/)
  assert.ok(nodes(app.render()).some(n => n.props?.role === 'alert' && n.props.children === 'Storage unavailable'))
})

test('the upload use case rejects unsupported types even without UI validation', async () => {
  const { UploadGuideImage } = loadClass('src/application/use-cases/UploadGuideImage.ts')
  const useCase = new UploadGuideImage({ upload() { throw new Error('Unexpected storage call') } })
  await assert.rejects(useCase.execute('wall', new Blob(['svg'], { type: 'image/svg+xml' })), /Choose JPG/)
  await assert.rejects(useCase.execute('../wall', new Blob(['png'], { type: 'image/png' })), /valid wall ID/)
})

test('mock image storage returns a preview without Supabase', async () => {
  const { MockGuideImageStorage } = loadClass('src/infrastructure/mock/MockGuideImageStorage.ts', { Uint8Array, btoa })
  const url = await new MockGuideImageStorage().upload('wall/prayer-guide/test.png', new Blob(['image'], { type: 'image/png' }))
  assert.equal(url, 'data:image/png;base64,aW1hZ2U=')
})
