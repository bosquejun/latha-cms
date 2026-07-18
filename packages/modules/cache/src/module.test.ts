import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapKon10, defineConfig } from 'kon10'
import type { CacheAdapter, DBAdapter } from 'kon10'
import { CacheModule } from './module.js'

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

test('CacheModule registers its adapter onto kon10.cache', async () => {
  const cache: CacheAdapter = {
    async get() { return undefined },
    async set() {},
    async delete() {},
    async has() { return false },
  }
  const kon10 = await bootstrapKon10(
    defineConfig({ db: fakeDb(), modules: [CacheModule({ cache })] }),
  )
  assert.equal(kon10.cache, cache)
})
