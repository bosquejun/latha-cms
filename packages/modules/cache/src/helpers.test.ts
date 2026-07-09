import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CacheAdapter, JsonValue, LathaInstance } from '@latha/core'
import { cached, invalidate } from './helpers.js'

function spyCache(): CacheAdapter & { getKeys: string[]; setKeys: string[] } {
  const store = new Map<string, JsonValue>()
  return {
    getKeys: [],
    setKeys: [],
    async get(key: string) {
      this.getKeys.push(key)
      return store.get(key)
    },
    async set(key: string, value: JsonValue) {
      this.setKeys.push(key)
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
    async has(key: string) {
      return store.has(key)
    },
  }
}

function fakeLatha(cache?: CacheAdapter): LathaInstance {
  return { cache } as unknown as LathaInstance
}

test('cached() recomputes and caches on a miss, then serves the hit', async () => {
  const cache = spyCache()
  const latha = fakeLatha(cache)
  let computeCalls = 0
  const compute = async () => {
    computeCalls++
    return { value: 'x' }
  }

  const first = await cached(latha, 'k', 30, compute)
  assert.deepEqual(first, { value: 'x' })
  assert.equal(computeCalls, 1)

  const second = await cached(latha, 'k', 30, compute)
  assert.deepEqual(second, { value: 'x' })
  assert.equal(computeCalls, 1, 'second call is served from cache, compute not re-run')
})

test('cached() never caches a null result', async () => {
  const cache = spyCache()
  const latha = fakeLatha(cache)
  let computeCalls = 0
  const compute = async () => {
    computeCalls++
    return null
  }

  await cached(latha, 'k', 30, compute)
  await cached(latha, 'k', 30, compute)
  assert.equal(computeCalls, 2, 'a null result is never cached, so compute always re-runs')
  assert.equal(cache.setKeys.length, 0)
})

test('cached() always recomputes when no cache is registered', async () => {
  const latha = fakeLatha(undefined)
  let computeCalls = 0
  const compute = async () => {
    computeCalls++
    return 'v'
  }

  await cached(latha, 'k', 30, compute)
  await cached(latha, 'k', 30, compute)
  assert.equal(computeCalls, 2)
})

test('invalidate() deletes the key, and is a no-op with no cache registered', async () => {
  const cache = spyCache()
  const latha = fakeLatha(cache)
  await cached(latha, 'k', 30, async () => 'v')
  assert.equal(await cache.has('k'), true)

  await invalidate(latha, 'k')
  assert.equal(await cache.has('k'), false)

  await invalidate(fakeLatha(undefined), 'k') // must not throw
})
