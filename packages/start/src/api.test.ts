/**
 * Delivery-API integration coverage: a real bootstrapped instance (AuthModule
 * with catalog sync + role seeding) over an in-memory adapter, exercised
 * through `handleDeliveryRequest` exactly as the route handler calls it.
 *
 * Proves the v1 security posture: deny-by-default for anonymous callers,
 * reads open up via the Public role or an API key, hidden fields never leave
 * the surface, and CORS/pagination behave.
 */

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  defineConfig,
  stampFields,
  text,
  boolean,
  type DBAdapter,
  type Doc,
  type Entity,
  type Query,
  type ResolvedConfig,
} from '@latha/core'
import { AuthModule, createApiKey } from '@latha/auth'
import { handleDeliveryRequest, handleDeliveryPreflight } from './api.js'
import { getRuntime } from './runtime.js'

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

const postsEntity: Entity = {
  cardinality: 'many',
  slug: 'posts',
  actions: ['read', 'create', 'update', 'delete'],
  fields: stampFields({
    title: text({ required: true }),
    internalNote: text({ meta: { hidden: true } }),
    featured: boolean({ defaultValue: false }),
  }),
}

const config: ResolvedConfig = defineConfig({
  db: memoryAdapter(),
  modules: [
    AuthModule({ secret: 'test-secret' }),
    { name: 'test-content', entities: [postsEntity] },
  ],
})

const get = (path: string, headers?: Record<string, string>) =>
  handleDeliveryRequest(config, new Request(`http://cms.test${path}`, { headers }))

before(async () => {
  const latha = await getRuntime(config)
  await latha.db.create('posts', { title: 'Hello', internalNote: 'secret', featured: true })
  await latha.db.create('posts', { title: 'World', internalNote: 'secret', featured: false })
})

test('anonymous read is denied until the Public role grants it', async () => {
  const res = await get('/api/posts')
  assert.equal(res.status, 403)
  assert.equal(res.headers.get('access-control-allow-origin'), '*')
})

test('unknown entities and bad paths 404', async () => {
  assert.equal((await get('/api/nope')).status, 404)
  assert.equal((await get('/api/a/b/c')).status, 404)
})

test('non-GET methods are rejected', async () => {
  const res = await handleDeliveryRequest(
    config,
    new Request('http://cms.test/api/posts', { method: 'POST' }),
  )
  assert.equal(res.status, 405)
})

test('invalid bearer tokens fail loudly, not as Public', async () => {
  const res = await get('/api/posts', { authorization: 'Bearer latha_bogus' })
  assert.equal(res.status, 401)
  const other = await get('/api/posts', { authorization: 'Basic dXNlcg==' })
  assert.equal(other.status, 401)
})

test('an API key carrying the admin role reads, with hidden fields stripped', async () => {
  const latha = await getRuntime(config)
  const adminRole = (await latha.db.find('roles', { where: { name: 'admin' }, limit: 1 }))[0]!
  const { token } = await createApiKey(latha, { name: 'test', roles: [adminRole.id] })

  const res = await get('/api/posts?sort=title', { authorization: `Bearer ${token}` })
  assert.equal(res.status, 200)
  const body = (await res.json()) as { docs: Doc[]; total: number; limit: number; offset: number }
  assert.equal(body.total, 2)
  assert.equal(body.docs.length, 2)
  assert.ok(body.docs.every((d) => !('internalNote' in d)))
  assert.ok(body.docs.every((d) => typeof d.title === 'string'))
})

test('granting the Public role a read opens anonymous access', async () => {
  const latha = await getRuntime(config)
  const permission = (
    await latha.db.find('permissions', { where: { key: 'posts:read' }, limit: 1 })
  )[0]!
  const publicRole = (await latha.db.find('roles', { where: { name: 'public' }, limit: 1 }))[0]!
  await latha.db.update('roles', publicRole.id, { permissions: [permission.id] })

  const list = await get('/api/posts?where[featured]=true&limit=1')
  assert.equal(list.status, 200)
  const body = (await list.json()) as { docs: Doc[]; total: number }
  assert.equal(body.total, 1)
  assert.equal(body.docs[0]!.title, 'Hello')
  assert.ok(!('internalNote' in body.docs[0]!))

  const one = await get(`/api/posts/${body.docs[0]!.id}`)
  assert.equal(one.status, 200)

  const missing = await get('/api/posts/does-not-exist')
  assert.equal(missing.status, 404)

  // But the Public grant does not leak other entities.
  assert.equal((await get('/api/roles')).status, 403)
})

test('unknown sort/filter fields are 400s, not silent full scans', async () => {
  assert.equal((await get('/api/posts?sort=nope')).status, 400)
  assert.equal((await get('/api/posts?where[nope]=1')).status, 400)
})

test('preflight answers with CORS headers', () => {
  const res = handleDeliveryPreflight(
    config,
    new Request('http://cms.test/api/posts', {
      method: 'OPTIONS',
      headers: { origin: 'https://site.example' },
    }),
  )
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('access-control-allow-origin'), '*')
  assert.match(res.headers.get('access-control-allow-methods') ?? '', /GET/)
})
