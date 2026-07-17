import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redisCache, type RedisClientLike } from './redis.js'

function fakeRedisClient(): RedisClientLike & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    async get(key) {
      return store.get(key) ?? null
    },
    async set(key: string, value: string, ..._rest: unknown[]) {
      store.set(key, value)
      return 'OK'
    },
    async del(key) {
      return store.delete(key) ? 1 : 0
    },
    async exists(key) {
      return store.has(key) ? 1 : 0
    },
  }
}

test('set/get/has/delete round-trip through JSON (de)serialization', async () => {
  const client = fakeRedisClient()
  const cache = redisCache({ client })

  assert.equal(await cache.has('a'), false)
  assert.equal(await cache.get('a'), undefined)

  await cache.set('a', { hello: 'world' })
  assert.equal(client.store.get('a'), '{"hello":"world"}')
  assert.equal(await cache.has('a'), true)
  assert.deepEqual(await cache.get('a'), { hello: 'world' })

  await cache.delete('a')
  assert.equal(await cache.has('a'), false)
})

test('keyPrefix namespaces every key sent to the client', async () => {
  const client = fakeRedisClient()
  const cache = redisCache({ client, keyPrefix: 'app1:' })

  await cache.set('a', 1)
  assert.equal(client.store.has('app1:a'), true)
  assert.equal(client.store.has('a'), false)
  assert.equal(await cache.get('a'), 1)
})

test('constructing with a url does not connect eagerly (build-safe)', () => {
  // Regression: `new Redis(url)` used to dial the moment `redisCache()` ran,
  // so importing a config that calls it during a build triggered a connection
  // attempt (ECONNREFUSED). The default client now uses `lazyConnect`, so
  // construction is side-effect-free — no throw, no unhandled 'error' event.
  assert.doesNotThrow(() => {
    redisCache({ url: 'redis://127.0.0.1:6390' })
  })
})
