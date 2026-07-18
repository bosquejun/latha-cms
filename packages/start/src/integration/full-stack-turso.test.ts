/**
 * Cross-module + real-adapter, meeting point of both test tracks: the full
 * module graph (Users + Auth + Content + slug + cache) booted over a live
 * `tursoAdapter({ url: ':memory:' })` — real `migrate` over every entity — then
 * a create-via-RPC → read-via-delivery-API round-trip. Proves non-scalar field
 * shapes survive real SQL marshaling (number, a JSON array from a `many`
 * taxonomy, a nested `group` object, a relationship id) and that the published
 * delivery constraint holds against real SQL.
 */

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createApiKey, getRoleByName } from '@kon10/auth'
import { tursoAdapter } from '@kon10/storage'
import type { ResolvedConfig } from '@kon10/core'
import type { JsonDoc } from '@kon10/studio-sdk'
import { getRuntime } from '../runtime.js'
import { handleDeliveryRequest } from '../api.js'
import type { ApiResponse } from '../envelope.js'
import { ADMIN_EMAIL, ADMIN_PASSWORD, buildTestConfig, login, rpc } from './fixture.js'

let config: ResolvedConfig
let adminCookie: string
let apiToken: string
let categoryId: string
let tagIds: string[]

before(async () => {
  config = buildTestConfig(tursoAdapter({ url: ':memory:' }))
  adminCookie = await login(config, ADMIN_EMAIL, ADMIN_PASSWORD)

  const kon10 = await getRuntime(config)
  categoryId = (await kon10.db.find('categories', { where: { slug: 'engineering' }, limit: 1 }))[0]!.id
  tagIds = (await kon10.db.find('tags')).map((t) => t.id)

  const adminRole = await getRoleByName(kon10, 'admin')
  const { token } = await createApiKey(kon10, { name: 'delivery', roles: adminRole ? [adminRole.id] : [] })
  apiToken = token
})

const deliveryGet = (path: string) =>
  handleDeliveryRequest(
    config,
    new Request(`http://cms.test${path}`, { headers: { authorization: `Bearer ${apiToken}` } }),
  )

test('a published post survives real-SQL marshaling through the delivery API', async () => {
  const created = (await rpc(
    config,
    {
      action: 'create',
      slug: 'posts',
      data: {
        title: 'Live One',
        status: 'published',
        views: 7,
        category: categoryId,
        tags: tagIds,
        seo: { metaTitle: 'Live One — Meta' },
      },
    },
    adminCookie,
  )) as JsonDoc
  // A draft that the published delivery constraint must hide.
  await rpc(config, { action: 'create', slug: 'posts', data: { title: 'Draft One' } }, adminCookie)

  const res = await deliveryGet('/api/v1/contents/posts')
  assert.equal(res.status, 200)
  const body = (await res.json()) as ApiResponse<JsonDoc[]>
  assert.equal(body.error, null)

  // Only the published row is delivered (drafts constraint over real SQL).
  assert.equal(body.data!.length, 1)
  const post = body.data![0]!
  assert.equal(post.id, created.id)
  assert.equal(post.title, 'Live One')

  // Marshaling fidelity across the SQL boundary:
  assert.equal(post.views, 7) // number
  assert.ok(Array.isArray(post.tags)) // JSON array from a `many` taxonomy
  assert.deepEqual(post.tags, tagIds)
  assert.equal(post.category, categoryId) // relationship id (scalar string)
  assert.equal((post.seo as { metaTitle: string }).metaTitle, 'Live One — Meta') // nested group object
})

test('fetching the published post by id also round-trips', async () => {
  const list = (await deliveryGet('/api/v1/contents/posts').then((r) => r.json())) as ApiResponse<JsonDoc[]>
  const id = list.data![0]!.id

  const res = await deliveryGet(`/api/v1/contents/posts/${id}`)
  assert.equal(res.status, 200)
  const body = (await res.json()) as ApiResponse<JsonDoc>
  assert.equal(body.error, null)
  assert.equal(body.data!.id, id)
  assert.equal(body.data!.views, 7)
})
