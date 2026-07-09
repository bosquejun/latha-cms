import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapLatha, defineConfig } from '@latha/core'
import type { CacheAdapter, DBAdapter } from '@latha/core'
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

test('CacheModule registers its adapter onto latha.cache', async () => {
  const cache: CacheAdapter = {
    async get() { return undefined },
    async set() {},
    async delete() {},
    async has() { return false },
  }
  const latha = await bootstrapLatha(
    defineConfig({ db: fakeDb(), modules: [CacheModule({ cache })] }),
  )
  assert.equal(latha.cache, cache)
})
