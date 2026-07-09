import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inMemoryCache } from './in-memory.js'

test('set/get/has/delete round-trip', async () => {
  const cache = inMemoryCache()
  assert.equal(await cache.has('a'), false)
  assert.equal(await cache.get('a'), undefined)

  await cache.set('a', { hello: 'world' })
  assert.equal(await cache.has('a'), true)
  assert.deepEqual(await cache.get('a'), { hello: 'world' })

  await cache.delete('a')
  assert.equal(await cache.has('a'), false)
  assert.equal(await cache.get('a'), undefined)
})

test('entries expire after ttlSeconds', async () => {
  const cache = inMemoryCache()
  await cache.set('a', 1, 0.01) // 10ms
  assert.equal(await cache.get('a'), 1)
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(await cache.get('a'), undefined)
  assert.equal(await cache.has('a'), false)
})

test('entries without a ttl never expire', async () => {
  const cache = inMemoryCache()
  await cache.set('a', 'forever')
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(await cache.get('a'), 'forever')
})
