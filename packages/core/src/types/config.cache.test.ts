import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapLatha, defineConfig } from '../bootstrap/index.js'
import type { CacheAdapter, DBAdapter } from './adapter.js'

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

test('a module can register a cache adapter via registerCacheAdapter', async () => {
  const cache: CacheAdapter = {
    async get() { return undefined },
    async set() {},
    async delete() {},
    async has() { return false },
  }
  const latha = await bootstrapLatha(
    defineConfig({
      db: fakeDb(),
      modules: [{ name: 'cache', onInit: (cms) => cms.registerCacheAdapter(cache) }],
    }),
  )
  assert.equal(latha.cache, cache)
})

test('cache is undefined when no module registers one', async () => {
  const latha = await bootstrapLatha(defineConfig({ db: fakeDb(), modules: [] }))
  assert.equal(latha.cache, undefined)
})
