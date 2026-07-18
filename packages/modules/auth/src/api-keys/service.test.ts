/**
 * API key coverage: token shape/hashing, and create → verify round-trips
 * against an in-memory fake DB (unknown, disabled, and expired keys deny).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CacheAdapter, Doc, JsonValue, Kon10Instance, Query } from 'kon10'
import { apiKeysEntity } from './entities.js'
import { createApiKey, verifyApiKeyToken } from './service.js'
import {
  API_KEY_TOKEN_PREFIX,
  PUBLISHABLE_TOKEN_PREFIX,
  SECRET_TOKEN_PREFIX,
  apiKeyClassOf,
  apiKeyDisplayPrefix,
  generateApiKeyToken,
  hashApiKeyToken,
} from './token.js'

/** A `CacheAdapter` that counts `get`/`set` calls, backed by a plain `Map`. */
function spyCache(): CacheAdapter & { getCalls: number; setCalls: number } {
  const store = new Map<string, JsonValue>()
  return {
    getCalls: 0,
    setCalls: 0,
    async get(key: string) {
      this.getCalls++
      return store.get(key)
    },
    async set(key: string, value: JsonValue) {
      this.setCalls++
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

/** Minimal fake instance: an in-memory `api-keys` table, no roles/catalog. */
function fakeKon10(cache?: CacheAdapter): Kon10Instance {
  const rows = new Map<string, Doc>()
  let seq = 0
  const db = {
    async find(_slug: string, query?: Query) {
      const all = [...rows.values()]
      const where = query?.where ?? {}
      const matched = all.filter((row) =>
        Object.entries(where).every(([k, v]) => row[k] === v),
      )
      return matched.slice(0, query?.limit ?? matched.length)
    },
    async findOne(_slug: string, id: string) {
      return rows.get(id) ?? null
    },
    async count() {
      return rows.size
    },
    async create(_slug: string, data: Record<string, unknown>) {
      const doc = { id: `k${++seq}`, ...data } as Doc
      rows.set(doc.id, doc)
      return doc
    },
    async update(_slug: string, id: string, data: Record<string, unknown>) {
      const doc = { ...rows.get(id)!, ...data } as Doc
      rows.set(id, doc)
      return doc
    },
    async delete(_slug: string, id: string) {
      rows.delete(id)
    },
    async migrate() {},
  }
  return { db, cache } as unknown as Kon10Instance
}

test('generateApiKeyToken: prefixed, high-entropy, unique', () => {
  const a = generateApiKeyToken()
  const b = generateApiKeyToken()
  assert.ok(a.startsWith(API_KEY_TOKEN_PREFIX))
  assert.ok(a.length >= API_KEY_TOKEN_PREFIX.length + 40)
  assert.notEqual(a, b)
})

test('hashApiKeyToken: deterministic SHA-256 hex', async () => {
  const token = 'kon10_fixed'
  const first = await hashApiKeyToken(token)
  assert.equal(first, await hashApiKeyToken(token))
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.notEqual(first, await hashApiKeyToken('kon10_other'))
})

test('apiKeyDisplayPrefix keeps only the identifying head', () => {
  const token = generateApiKeyToken() // secret by default
  const prefix = apiKeyDisplayPrefix(token)
  assert.ok(token.startsWith(prefix))
  assert.equal(prefix.length, SECRET_TOKEN_PREFIX.length + 8)
})

test('token class: pk_/sk_ prefixes; default and legacy resolve as secret', () => {
  assert.ok(generateApiKeyToken('publishable').startsWith(PUBLISHABLE_TOKEN_PREFIX))
  assert.ok(generateApiKeyToken('secret').startsWith(SECRET_TOKEN_PREFIX))
  assert.ok(generateApiKeyToken().startsWith(SECRET_TOKEN_PREFIX))
  // Both still carry the umbrella prefix the delivery API detects.
  assert.ok(generateApiKeyToken('publishable').startsWith(API_KEY_TOKEN_PREFIX))
  assert.equal(apiKeyClassOf(generateApiKeyToken('publishable')), 'publishable')
  assert.equal(apiKeyClassOf(generateApiKeyToken('secret')), 'secret')
  assert.equal(apiKeyClassOf('kon10_legacytoken'), 'secret')
})

test('createApiKey stores the hash, never the token', async () => {
  const kon10 = fakeKon10()
  const { id, token } = await createApiKey(kon10, { name: 'ci' })
  const doc = await kon10.db.findOne('api-keys', id)
  assert.ok(doc)
  assert.equal(doc.keyHash, await hashApiKeyToken(token))
  assert.equal(doc.prefix, apiKeyDisplayPrefix(token))
  assert.ok(!Object.values(doc).includes(token))
})

test('verifyApiKeyToken: round-trip resolves a principal', async () => {
  const kon10 = fakeKon10()
  const { id, token } = await createApiKey(kon10, { name: 'ci' })
  const principal = await verifyApiKeyToken(kon10, token)
  assert.ok(principal)
  assert.equal(principal.id, `apikey:${id}`)
  assert.equal(principal.kind, 'api-key')
  assert.equal(principal.name, 'ci')
})

test('verifyApiKeyToken: unknown / malformed tokens deny', async () => {
  const kon10 = fakeKon10()
  await createApiKey(kon10, { name: 'ci' })
  assert.equal(await verifyApiKeyToken(kon10, generateApiKeyToken()), null)
  assert.equal(await verifyApiKeyToken(kon10, 'not-a-kon10-token'), null)
})

test('verifyApiKeyToken: disabled keys deny', async () => {
  const kon10 = fakeKon10()
  const { id, token } = await createApiKey(kon10, { name: 'ci' })
  await kon10.db.update('api-keys', id, { enabled: false })
  assert.equal(await verifyApiKeyToken(kon10, token), null)
})

test('verifyApiKeyToken: expired keys deny, future expiry allows', async () => {
  const kon10 = fakeKon10()
  const past = await createApiKey(kon10, {
    name: 'old',
    expiresAt: new Date(Date.now() - 1000),
  })
  const future = await createApiKey(kon10, {
    name: 'new',
    expiresAt: new Date(Date.now() + 60_000),
  })
  assert.equal(await verifyApiKeyToken(kon10, past.token), null)
  assert.ok(await verifyApiKeyToken(kon10, future.token))
})

test('verifyApiKeyToken caches the resolved doc when a cache is registered', async () => {
  const cache = spyCache()
  const kon10 = fakeKon10(cache)
  const { token } = await createApiKey(kon10, { name: 'ci' })

  await verifyApiKeyToken(kon10, token)
  assert.equal(cache.setCalls, 1)

  await verifyApiKeyToken(kon10, token)
  assert.equal(cache.setCalls, 1, 'second call is served from cache, not recomputed')
  assert.equal(cache.getCalls, 2)
})

test('the entity afterUpdate hook invalidates a disabled key immediately, not stale-until-TTL', async () => {
  const cache = spyCache()
  const kon10 = fakeKon10(cache)
  const { id, token } = await createApiKey(kon10, { name: 'ci' })

  assert.ok(await verifyApiKeyToken(kon10, token), 'caches the enabled doc')

  const updated = await kon10.db.update('api-keys', id, { enabled: false })
  await apiKeysEntity.hooks!.afterUpdate![0]!({
    data: updated as Record<string, unknown>,
    principal: null,
    operation: 'update',
    slug: 'api-keys',
    cms: kon10,
  })

  assert.equal(
    await verifyApiKeyToken(kon10, token),
    null,
    'invalidated entry is re-fetched and denies immediately',
  )
})

test('the entity afterDelete hook invalidates the deleted key immediately', async () => {
  const cache = spyCache()
  const kon10 = fakeKon10(cache)
  const { id, token } = await createApiKey(kon10, { name: 'ci' })
  const doc = await kon10.db.findOne('api-keys', id)

  assert.ok(await verifyApiKeyToken(kon10, token), 'caches the doc')

  await kon10.db.delete('api-keys', id)
  await apiKeysEntity.hooks!.afterDelete![0]!({
    data: doc as Record<string, unknown>,
    principal: null,
    operation: 'delete',
    slug: 'api-keys',
    cms: kon10,
  })

  assert.equal(await verifyApiKeyToken(kon10, token), null, 'deleted key denies immediately')
})

test('verify resolves a publishable key with its guardrail config', async () => {
  const kon10 = fakeKon10()
  const { token } = await createApiKey(kon10, {
    name: 'pk',
    type: 'publishable',
    allowedOrigins: ['https://a.example', 'https://b.example'],
    rateLimitPerMinute: 60,
  })
  assert.ok(token.startsWith(PUBLISHABLE_TOKEN_PREFIX))
  const principal = await verifyApiKeyToken(kon10, token)
  assert.ok(principal)
  assert.equal(principal.publishable, true)
  assert.deepEqual(principal.allowedOrigins, ['https://a.example', 'https://b.example'])
  assert.equal(principal.rateLimitPerMinute, 60)
})

test('verify resolves a secret key (default) as non-publishable, no guardrails', async () => {
  const kon10 = fakeKon10()
  const { token } = await createApiKey(kon10, { name: 'sk' })
  assert.ok(token.startsWith(SECRET_TOKEN_PREFIX))
  const principal = await verifyApiKeyToken(kon10, token)
  assert.equal(principal?.publishable, false)
  assert.equal(principal?.allowedOrigins, undefined)
  assert.equal(principal?.rateLimitPerMinute, undefined)
})
