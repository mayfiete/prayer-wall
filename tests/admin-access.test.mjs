import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile(new URL('../src/infrastructure/auth/admin-access.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
})
const exports = {}
vm.runInNewContext(outputText, { exports })
const { canAccessAdmin } = exports

test('the server checks identity, and only explicit approval opens the admin guard', async () => {
  const calls = []
  assert.equal(await canAccessAdmin({ rpc: async (...args) => { calls.push(args); return { data: true, error: null } } }), true)
  assert.deepEqual(calls, [['is_app_admin']])
  for (const data of [false, null, undefined, 'true', 1]) {
    assert.equal(await canAccessAdmin({ rpc: async () => ({ data, error: null }) }), false)
  }
})

test('missing migration, invalid sessions and network failures deny access', async () => {
  assert.equal(await canAccessAdmin({ rpc: async () => ({ data: true, error: { message: 'denied' } }) }), false)
  assert.equal(await canAccessAdmin({ rpc: async () => { throw new Error('network unavailable') } }), false)
})
