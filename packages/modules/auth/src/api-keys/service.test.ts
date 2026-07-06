/**
 * API key coverage: token shape/hashing, and create → verify round-trips
 * against an in-memory fake DB (unknown, disabled, and expired keys deny).
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Doc, LathaInstance, Query } from '@latha/core'
import { createApiKey, verifyApiKeyToken } from './service.js'
import {
  API_KEY_TOKEN_PREFIX,
  apiKeyDisplayPrefix,
  generateApiKeyToken,
  hashApiKeyToken,
} from './token.js'

/** Minimal fake instance: an in-memory `api-keys` table, no roles/catalog. */
function fakeLatha(): LathaInstance {
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
  return { db } as unknown as LathaInstance
}

test('generateApiKeyToken: prefixed, high-entropy, unique', () => {
  const a = generateApiKeyToken()
  const b = generateApiKeyToken()
  assert.ok(a.startsWith(API_KEY_TOKEN_PREFIX))
  assert.ok(a.length >= API_KEY_TOKEN_PREFIX.length + 40)
  assert.notEqual(a, b)
})

test('hashApiKeyToken: deterministic SHA-256 hex', async () => {
  const token = 'latha_fixed'
  const first = await hashApiKeyToken(token)
  assert.equal(first, await hashApiKeyToken(token))
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.notEqual(first, await hashApiKeyToken('latha_other'))
})

test('apiKeyDisplayPrefix keeps only the identifying head', () => {
  const token = generateApiKeyToken()
  const prefix = apiKeyDisplayPrefix(token)
  assert.ok(token.startsWith(prefix))
  assert.equal(prefix.length, API_KEY_TOKEN_PREFIX.length + 8)
})

test('createApiKey stores the hash, never the token', async () => {
  const latha = fakeLatha()
  const { id, token } = await createApiKey(latha, { name: 'ci' })
  const doc = await latha.db.findOne('api-keys', id)
  assert.ok(doc)
  assert.equal(doc.keyHash, await hashApiKeyToken(token))
  assert.equal(doc.prefix, apiKeyDisplayPrefix(token))
  assert.ok(!Object.values(doc).includes(token))
})

test('verifyApiKeyToken: round-trip resolves a principal', async () => {
  const latha = fakeLatha()
  const { id, token } = await createApiKey(latha, { name: 'ci' })
  const principal = await verifyApiKeyToken(latha, token)
  assert.ok(principal)
  assert.equal(principal.id, `apikey:${id}`)
  assert.equal(principal.kind, 'api-key')
  assert.equal(principal.name, 'ci')
})

test('verifyApiKeyToken: unknown / malformed tokens deny', async () => {
  const latha = fakeLatha()
  await createApiKey(latha, { name: 'ci' })
  assert.equal(await verifyApiKeyToken(latha, generateApiKeyToken()), null)
  assert.equal(await verifyApiKeyToken(latha, 'not-a-latha-token'), null)
})

test('verifyApiKeyToken: disabled keys deny', async () => {
  const latha = fakeLatha()
  const { id, token } = await createApiKey(latha, { name: 'ci' })
  await latha.db.update('api-keys', id, { enabled: false })
  assert.equal(await verifyApiKeyToken(latha, token), null)
})

test('verifyApiKeyToken: expired keys deny, future expiry allows', async () => {
  const latha = fakeLatha()
  const past = await createApiKey(latha, {
    name: 'old',
    expiresAt: new Date(Date.now() - 1000),
  })
  const future = await createApiKey(latha, {
    name: 'new',
    expiresAt: new Date(Date.now() + 60_000),
  })
  assert.equal(await verifyApiKeyToken(latha, past.token), null)
  assert.ok(await verifyApiKeyToken(latha, future.token))
})
