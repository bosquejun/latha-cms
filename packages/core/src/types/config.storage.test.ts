import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapLatha, defineConfig } from '../bootstrap/index.js'
import type { DBAdapter, StorageAdapter } from './adapter.js'

function fakeDb(): DBAdapter {
  return {
    async find() { return [] },
    async findOne() { return null },
    async count() { return 0 },
    async create(_c, data) { return { id: '1', ...data } },
    async update(_c, id, data) { return { id, ...data } },
    async delete() {},
    async migrate() {},
  }
}

test('a module can register a storage adapter via registerStorageAdapter', async () => {
  const storage: StorageAdapter = {
    async upload() { return { url: '/x', key: 'x' } },
    async delete() {},
  }
  const latha = await bootstrapLatha(
    defineConfig({
      db: fakeDb(),
      modules: [{ name: 'media', onInit: (cms) => cms.registerStorageAdapter(storage) }],
    }),
  )
  assert.equal(latha.storage, storage)
})

test('storage is undefined when no module registers one', async () => {
  const latha = await bootstrapLatha(defineConfig({ db: fakeDb(), modules: [] }))
  assert.equal(latha.storage, undefined)
})
