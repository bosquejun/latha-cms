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

test('LathaInstance exposes the configured storage adapter', async () => {
  const storage: StorageAdapter = {
    async upload() { return { url: '/x', key: 'x' } },
    async delete() {},
  }
  const latha = await bootstrapLatha(defineConfig({ db: fakeDb(), modules: [], storage }))
  assert.equal(latha.storage, storage)
})

test('storage is undefined when not configured', async () => {
  const latha = await bootstrapLatha(defineConfig({ db: fakeDb(), modules: [] }))
  assert.equal(latha.storage, undefined)
})
