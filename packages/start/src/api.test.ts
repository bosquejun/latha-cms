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
} from '@kon10/core'
import { AuthModule, createApiKey } from '@kon10/auth'
import { handleDeliveryRequest, handleDeliveryPreflight } from './api.js'
import { getRuntime } from './runtime.js'
import type { ApiResponse } from './envelope.js'

/** Narrow an envelope to its success variant, asserting `error` is `null` along the way. */
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

// Drafts-style entity: the delivery constraint every public read is scoped to.
const articlesEntity: Entity = {
  cardinality: 'many',
  slug: 'articles',
  actions: ['read', 'create', 'update', 'delete'],
  api: { where: { status: 'published' } },
  fields: stampFields({
    title: text({ required: true }),
    status: text(),
  }),
}

// A single-entity module: exercises the collapsed `/api/v1/<prefix>` form
// (no redundant slug segment) alongside `test-content`'s multi-entity,
// slug-disambiguated form.
const widgetEntity: Entity = {
  cardinality: 'many',
  slug: 'widget',
  actions: ['read', 'create', 'update', 'delete'],
  access: { read: () => true },
  fields: stampFields({ name: text({ required: true }) }),
}

const config: ResolvedConfig = defineConfig({
  db: memoryAdapter(),
  modules: [
    AuthModule({ secret: 'test-secret' }),
    { name: 'test-content', entities: [postsEntity, articlesEntity] },
    { name: 'widgets', entities: [widgetEntity] },
  ],
})

const get = (path: string, headers?: Record<string, string>) =>
  handleDeliveryRequest(config, new Request(`http://cms.test${path}`, { headers }))

before(async () => {
  const kon10 = await getRuntime(config)
  await kon10.db.create('posts', { title: 'Hello', internalNote: 'secret', featured: true })
  await kon10.db.create('posts', { title: 'World', internalNote: 'secret', featured: false })
  await kon10.db.create('articles', { title: 'Live', status: 'published' })
  await kon10.db.create('articles', { title: 'WIP', status: 'draft' })
  await kon10.db.create('widget', { name: 'Gadget' })
})

test('anonymous read is denied until the Public role grants it', async () => {
  const res = await get('/api/v1/test-content/posts')
  assert.equal(res.status, 403)
  assert.equal(res.headers.get('access-control-allow-origin'), '*')
  const body = (await res.json()) as ApiResponse<unknown>
  assert.equal(body.data, null)
  assert.deepEqual(body.error, { code: 'FORBIDDEN', message: 'Forbidden.' })
})

test('unknown module prefixes, unknown entity slugs, and over-deep paths 404', async () => {
  for (const path of ['/api/v1/nope', '/api/v1/test-content/nope', '/api/v1/test-content/posts/id/extra']) {
    const res = await get(path)
    assert.equal(res.status, 404)
    const body = (await res.json()) as ApiResponse<unknown>
    assert.equal(body.data, null)
    assert.deepEqual(body.error, { code: 'NOT_FOUND', message: 'Not found.' })
  }
})

test('a module with exactly one entity is addressed without a redundant slug segment', async () => {
  const list = await get('/api/v1/widgets')
  assert.equal(list.status, 200)
  const body = (await list.json()) as ApiResponse<Doc[]>
  assertSuccess(body)
  assert.deepEqual(body.pagination, { page: 1, pageSize: 50, total: 1, hasMore: false })
  assert.equal(body.data![0]!.name, 'Gadget')

  const one = await get(`/api/v1/widgets/${body.data![0]!.id}`)
  assert.equal(one.status, 200)
  const oneBody = (await one.json()) as ApiResponse<Doc>
  assertSuccess(oneBody)
  assert.equal(oneBody.data.name, 'Gadget')
  // Pagination never appears on a single-resource response.
  assert.equal('pagination' in oneBody, false)
})

test('non-GET methods are rejected', async () => {
  const res = await handleDeliveryRequest(
    config,
    new Request('http://cms.test/api/v1/test-content/posts', { method: 'POST' }),
  )
  assert.equal(res.status, 405)
  const body = (await res.json()) as ApiResponse<unknown>
  assert.deepEqual(body.error, { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' })
})

test('invalid bearer tokens fail loudly, not as Public', async () => {
  const res = await get('/api/v1/test-content/posts', { authorization: 'Bearer kon10_bogus' })
  assert.equal(res.status, 401)
  assert.equal(res.headers.get('access-control-allow-origin'), '*')
  const body = (await res.json()) as ApiResponse<unknown>
  assert.equal(body.error?.code, 'UNAUTHORIZED')
  const other = await get('/api/v1/test-content/posts', { authorization: 'Basic dXNlcg==' })
  assert.equal(other.status, 401)
})

test('an API key carrying the admin role reads, with hidden fields stripped', async () => {
  const kon10 = await getRuntime(config)
  const adminRole = (await kon10.db.find('roles', { where: { name: 'admin' }, limit: 1 }))[0]!
  const { token } = await createApiKey(kon10, { name: 'test', roles: [adminRole.id] })

  const res = await get('/api/v1/test-content/posts?sort=title', {
    authorization: `Bearer ${token}`,
  })
  assert.equal(res.status, 200)
  const body = (await res.json()) as ApiResponse<Doc[]>
  assertSuccess(body)
  assert.equal(body.pagination?.total, 2)
  assert.equal(body.data.length, 2)
  assert.ok(body.data.every((d) => !('internalNote' in d)))
  assert.ok(body.data.every((d) => typeof d.title === 'string'))
})

test('granting the Public role a read opens anonymous access', async () => {
  const kon10 = await getRuntime(config)
  const permission = (
    await kon10.db.find('permissions', { where: { key: 'posts:read' }, limit: 1 })
  )[0]!
  const publicRole = (await kon10.db.find('roles', { where: { name: 'public' }, limit: 1 }))[0]!
  await kon10.db.update('roles', publicRole.id, { permissions: [permission.id] })

  const list = await get('/api/v1/test-content/posts?where[featured]=true&pageSize=1')
  assert.equal(list.status, 200)
  const body = (await list.json()) as ApiResponse<Doc[]>
  assertSuccess(body)
  assert.equal(body.pagination?.total, 1)
  assert.equal(body.data[0]!.title, 'Hello')
  assert.ok(!('internalNote' in body.data[0]!))

  const one = await get(`/api/v1/test-content/posts/${body.data[0]!.id}`)
  assert.equal(one.status, 200)

  const missing = await get('/api/v1/test-content/posts/does-not-exist')
  assert.equal(missing.status, 404)

  // But the Public grant does not leak other entities — including ones
  // contributed by a different module (auth's `roles`).
  assert.equal((await get('/api/v1/auth/roles')).status, 403)
})

test('the delivery constraint hides drafts even from privileged keys', async () => {
  const kon10 = await getRuntime(config)
  const adminRole = (await kon10.db.find('roles', { where: { name: 'admin' }, limit: 1 }))[0]!
  const { token } = await createApiKey(kon10, { name: 'drafts', roles: [adminRole.id] })
  const auth = { authorization: `Bearer ${token}` }

  const list = await get('/api/v1/test-content/articles', auth)
  const body = (await list.json()) as ApiResponse<Doc[]>
  assertSuccess(body)
  assert.equal(body.pagination?.total, 1)
  assert.deepEqual(body.data.map((d) => d.title), ['Live'])

  // A caller's where[] can never widen the constraint.
  const widened = await get('/api/v1/test-content/articles?where[status]=draft', auth)
  const wbody = (await widened.json()) as ApiResponse<Doc[]>
  assertSuccess(wbody)
  assert.equal(wbody.pagination?.total, 1)
  assert.deepEqual(wbody.data.map((d) => d.title), ['Live'])

  // Direct fetch of a draft id 404s.
  const draft = (await kon10.db.find('articles', { where: { status: 'draft' } }))[0]!
  assert.equal((await get(`/api/v1/test-content/articles/${draft.id}`, auth)).status, 404)
})

test('unknown sort/filter fields are 400s, not silent full scans', async () => {
  const sortRes = await get('/api/v1/test-content/posts?sort=nope')
  assert.equal(sortRes.status, 400)
  const sortBody = (await sortRes.json()) as ApiResponse<unknown>
  assert.equal(sortBody.error?.code, 'BAD_REQUEST')

  assert.equal((await get('/api/v1/test-content/posts?where[nope]=1')).status, 400)
})

test('pagination reflects hasMore across a multi-page list', async () => {
  const kon10 = await getRuntime(config)
  const adminRole = (await kon10.db.find('roles', { where: { name: 'admin' }, limit: 1 }))[0]!
  const { token } = await createApiKey(kon10, { name: 'paging', roles: [adminRole.id] })

  const page1 = await get('/api/v1/test-content/posts?page=1&pageSize=1', {
    authorization: `Bearer ${token}`,
  })
  const body = (await page1.json()) as ApiResponse<Doc[]>
  assertSuccess(body)
  assert.deepEqual(body.pagination, { page: 1, pageSize: 1, total: 2, hasMore: true })

  const page2 = await get('/api/v1/test-content/posts?page=2&pageSize=1', {
    authorization: `Bearer ${token}`,
  })
  const body2 = (await page2.json()) as ApiResponse<Doc[]>
  assertSuccess(body2)
  assert.deepEqual(body2.pagination, { page: 2, pageSize: 1, total: 2, hasMore: false })
  assert.notDeepEqual(body2.data, body.data)
})

test('preflight answers with CORS headers', () => {
  const res = handleDeliveryPreflight(
    config,
    new Request('http://cms.test/api/test-content/posts', {
      method: 'OPTIONS',
      headers: { origin: 'https://site.example' },
    }),
  )
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('access-control-allow-origin'), '*')
  assert.match(res.headers.get('access-control-allow-methods') ?? '', /GET/)
})
