/**
 * Delivery-API read-through caching: `CacheModule` wired onto a `Kon10Instance`
 * is consulted by `handleDeliveryRequest` for successful (200) reads, scoped
 * per caller identity, and skippable per entity via `entity.api.cache`.
 */

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  silentLogger,
  defineConfig,
  stampFields,
  text,
  type CacheAdapter,
  type DBAdapter,
  type Doc,
  type Entity,
  type JsonValue,
  type Query,
  type ResolvedConfig,
} from 'kon10'
import { AuthModule, createApiKey } from '@kon10/auth'
import { CacheModule, inMemoryCache } from '@kon10/cache'
import { handleDeliveryRequest } from './api.js'
import { getRuntime } from './runtime.js'
import type { ApiResponse } from './envelope.js'

function assertSuccess<T>(
  body: ApiResponse<T>,
): asserts body is Extract<ApiResponse<T>, { error: null }> {
  assert.equal(body.error, null)
}

function memoryAdapter(): DBAdapter {
  const tables = new Map<string, Map<string, Doc>>()
  let seq = 0
  const table = (slug: string) => {
    let t = tables.get(slug)
    if (!t) tables.set(slug, (t = new Map()))
    return t
  }
  const matches = (doc: Doc, where?: Record<string, unknown>) =>
    Object.entries(where ?? {}).every(([k, v]) => doc[k] === v)

  return {
    async find(slug: string, query?: Query) {
      let rows = [...table(slug).values()].filter((d) => matches(d, query?.where))
      const offset = query?.offset ?? 0
      rows = rows.slice(offset, query?.limit != null ? offset + query.limit : undefined)
      return rows
    },
    async findOne(slug: string, id: string) {
      return table(slug).get(id) ?? null
    },
    async count(slug: string, query?: Query) {
      return [...table(slug).values()].filter((d) => matches(d, query?.where)).length
    },
    async create(slug: string, data: Record<string, unknown>) {
      const doc = { id: `r${++seq}`, ...data } as Doc
      table(slug).set(doc.id, doc)
      return doc
    },
    async update(slug: string, id: string, data: Record<string, unknown>) {
      const doc = { ...table(slug).get(id)!, ...data } as Doc
      table(slug).set(id, doc)
      return doc
    },
    async delete(slug: string, id: string) {
      table(slug).delete(id)
    },
    async migrate() {},
  }
}

/** A `CacheAdapter` that records every key it's asked to `get`/`set`. */
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

const widgetEntity: Entity = {
  cardinality: 'many',
  slug: 'widget',
  actions: ['read'],
  access: { read: () => true },
  fields: stampFields({ name: text({ required: true }) }),
}

const uncachedWidgetEntity: Entity = {
  cardinality: 'many',
  slug: 'uncached-widget',
  actions: ['read'],
  access: { read: () => true },
  api: { cache: false },
  fields: stampFields({ name: text({ required: true }) }),
}

// --- cache miss then hit ---------------------------------------------------

const hitConfig: ResolvedConfig = defineConfig({
  logger: silentLogger,
  db: memoryAdapter(),
  modules: [CacheModule({ cache: inMemoryCache() }), { name: 'widgets', entities: [widgetEntity] }],
})

before(async () => {
  const kon10 = await getRuntime(hitConfig)
  await kon10.db.create('widget', { name: 'Gadget' })
})

test('cache miss then hit returns the same body, even after an uncached write', async () => {
  const first = await handleDeliveryRequest(hitConfig, new Request('http://cms.test/api/v1/widgets'))
  const firstBody = (await first.json()) as ApiResponse<Doc[]>
  assertSuccess(firstBody)
  assert.equal(firstBody.data.length, 1)

  // Write directly to the db, bypassing the cache — proves staleness within
  // TTL is the expected v1 tradeoff (no invalidation-on-write yet).
  const kon10 = await getRuntime(hitConfig)
  await kon10.db.create('widget', { name: 'Widget2' })

  const second = await handleDeliveryRequest(hitConfig, new Request('http://cms.test/api/v1/widgets'))
  const secondBody = (await second.json()) as ApiResponse<Doc[]>
  assert.deepEqual(secondBody, firstBody)
})

// --- per-caller-identity cache keys -----------------------------------------
//
// Two distinct, real API keys (both with the seeded admin role, so both
// reads succeed) — proves a cached response for one caller is never reused
// for another, which matters because `entity.access`/guards can vary
// visible data by identity. An anonymous request is a third, separate
// identity ('anon') and needs no key at all.

const identityWidgetEntity: Entity = {
  ...widgetEntity,
  slug: 'identity-widget',
}

const spyConfig: ResolvedConfig = defineConfig({
  logger: silentLogger,
  db: memoryAdapter(),
  modules: [
    AuthModule({ secret: 'test-secret' }),
    CacheModule({ cache: spyCache() }),
    { name: 'widgets', entities: [identityWidgetEntity] },
  ],
})

test('requests with different Authorization headers get different cache keys', async () => {
  const kon10 = await getRuntime(spyConfig)
  const cache = kon10.cache as ReturnType<typeof spyCache>
  await kon10.db.create('identity-widget', { name: 'Gadget' })

  const adminRole = (await kon10.db.find('roles', { where: { name: 'admin' }, limit: 1 }))[0]!
  const keyA = await createApiKey(kon10, { name: 'a', roles: [adminRole.id] })
  const keyB = await createApiKey(kon10, { name: 'b', roles: [adminRole.id] })

  const resA = await handleDeliveryRequest(
    spyConfig,
    new Request('http://cms.test/api/v1/widgets', { headers: { authorization: `Bearer ${keyA.token}` } }),
  )
  const resB = await handleDeliveryRequest(
    spyConfig,
    new Request('http://cms.test/api/v1/widgets', { headers: { authorization: `Bearer ${keyB.token}` } }),
  )
  assert.equal(resA.status, 200)
  assert.equal(resB.status, 200)

  // Each request also warms @kon10/auth's own per-identity caches (the
  // api-key doc, the shared admin role) on the same shared cache instance —
  // by design, but orthogonal to what this test is proving. Only the
  // delivery-cache keys (one per distinct caller identity) are relevant here.
  const deliveryKeys = new Set(cache.setKeys.filter((k) => k.startsWith('delivery:')))
  assert.equal(deliveryKeys.size, 2)
})

// --- per-entity opt-out ------------------------------------------------------

const optOutConfig: ResolvedConfig = defineConfig({
  logger: silentLogger,
  db: memoryAdapter(),
  modules: [
    CacheModule({ cache: spyCache() }),
    { name: 'widgets', entities: [widgetEntity, uncachedWidgetEntity] },
  ],
})

test('an entity with api.cache: false is never read through or written to the cache', async () => {
  const kon10 = await getRuntime(optOutConfig)
  const cache = kon10.cache as ReturnType<typeof spyCache>
  await kon10.db.create('widget', { name: 'Gadget' })
  await kon10.db.create('uncached-widget', { name: 'Sprocket' })

  await handleDeliveryRequest(optOutConfig, new Request('http://cms.test/api/v1/widgets/widget'))
  assert.equal(cache.setKeys.length, 1)

  await handleDeliveryRequest(
    optOutConfig,
    new Request('http://cms.test/api/v1/widgets/uncached-widget'),
  )
  // Anonymous principal resolution (@kon10/auth's getPublicPrincipal) also
  // reads through the same shared cache instance on every request — that's
  // by design (one cms.cache serves every module), but it means only the
  // delivery-cache keys are relevant to this assertion, not the raw total.
  const deliveryGetKeys = cache.getKeys.filter((k) => k.startsWith('delivery:'))
  assert.equal(cache.setKeys.length, 1)
  assert.equal(deliveryGetKeys.length, 1)
})

// --- per-key rate limiting -------------------------------------------------

const rateLimitConfig: ResolvedConfig = defineConfig({
  logger: silentLogger,
  db: memoryAdapter(),
  modules: [
    AuthModule({ secret: 'test-secret' }),
    CacheModule({ cache: inMemoryCache() }),
    { name: 'widgets', entities: [widgetEntity] },
  ],
})

test('a per-key rate limit returns 429 once the window budget is spent', async () => {
  const kon10 = await getRuntime(rateLimitConfig)
  await kon10.db.create('widget', { name: 'Gadget' })
  const { token } = await createApiKey(kon10, {
    name: 'pk-rl',
    type: 'publishable',
    rateLimitPerMinute: 2,
  })
  const call = () =>
    handleDeliveryRequest(
      rateLimitConfig,
      new Request('http://cms.test/api/v1/widgets', {
        headers: { authorization: `Bearer ${token}` },
      }),
    )

  assert.equal((await call()).status, 200)
  assert.equal((await call()).status, 200)
  const third = await call()
  assert.equal(third.status, 429)
  const body = (await third.json()) as ApiResponse<unknown>
  assert.equal(body.error?.code, 'TOO_MANY_REQUESTS')
  assert.equal(third.headers.get('retry-after'), '60')
})
