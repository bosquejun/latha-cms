/**
 * RPC dispatcher end-to-end: drive `handleKon10Request` through the full action
 * switch (nav → create → list → page → get → update → saveGlobal/getGlobal →
 * remove) as a logged-in admin over the realistic multi-module config, then
 * prove the top-level `studio:access` gate denies an anonymous caller. This is
 * the whole Studio write path no existing test covers as one flow.
 */

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { AccessDeniedError } from '@kon10/core'
import type { ResolvedConfig } from '@kon10/core'
import type { JsonDoc, NavSection, PageResult } from '@kon10/studio-sdk'
import { ADMIN_EMAIL, ADMIN_PASSWORD, buildTestConfig, login, memoryAdapter, rpc } from './fixture.js'

let config: ResolvedConfig
let adminCookie: string

before(async () => {
  config = buildTestConfig(memoryAdapter())
  adminCookie = await login(config, ADMIN_EMAIL, ADMIN_PASSWORD)
})

test('nav lists the content entities the admin may read', async () => {
  const sections = (await rpc(config, { action: 'nav' }, adminCookie)) as NavSection[]
  const slugs = sections.flatMap((s) => s.items.map((i) => i.slug))
  for (const expected of ['posts', 'pages', 'categories', 'tags', 'site-settings']) {
    assert.ok(slugs.includes(expected), `nav should include ${expected}`)
  }
})

test('create → list → get → update → remove round-trips a post', async () => {
  const created = (await rpc(
    config,
    { action: 'create', slug: 'posts', data: { title: 'First Post', views: 3 } },
    adminCookie,
  )) as JsonDoc
  assert.equal(created.title, 'First Post')
  assert.equal(created.views, 3)
  assert.equal(created.status, 'draft') // Collection's implicit publish default

  const list = (await rpc(config, { action: 'list', slug: 'posts' }, adminCookie)) as JsonDoc[]
  assert.ok(list.some((d) => d.id === created.id))

  const page = (await rpc(
    config,
    { action: 'page', slug: 'posts', limit: 10, offset: 0 },
    adminCookie,
  )) as PageResult
  assert.equal(page.total, 1)
  assert.equal(page.docs[0]!.id, created.id)

  const fetched = (await rpc(
    config,
    { action: 'get', slug: 'posts', id: created.id },
    adminCookie,
  )) as JsonDoc
  assert.equal(fetched.title, 'First Post')

  const updated = (await rpc(
    config,
    { action: 'update', slug: 'posts', id: created.id, data: { title: 'Renamed Post' } },
    adminCookie,
  )) as JsonDoc
  assert.equal(updated.title, 'Renamed Post')

  const removed = (await rpc(
    config,
    { action: 'remove', slug: 'posts', id: created.id },
    adminCookie,
  )) as { id: string }
  assert.equal(removed.id, created.id)

  const empty = (await rpc(config, { action: 'list', slug: 'posts' }, adminCookie)) as JsonDoc[]
  assert.equal(
    empty.some((d) => d.id === created.id),
    false,
  )
})

test('saveGlobal upserts a singleton, getGlobal reads it back', async () => {
  assert.equal(await rpc(config, { action: 'getGlobal', slug: 'site-settings' }, adminCookie), null)

  const saved = (await rpc(
    config,
    { action: 'saveGlobal', slug: 'site-settings', data: { site_name: 'Kon10' } },
    adminCookie,
  )) as JsonDoc
  assert.equal(saved.site_name, 'Kon10')

  const again = (await rpc(
    config,
    { action: 'saveGlobal', slug: 'site-settings', data: { site_name: 'Kon10', tagline: 'CMS' } },
    adminCookie,
  )) as JsonDoc
  assert.equal(again.id, saved.id) // upsert, not a second row
  assert.equal(again.tagline, 'CMS')

  const read = (await rpc(
    config,
    { action: 'getGlobal', slug: 'site-settings' },
    adminCookie,
  )) as JsonDoc
  assert.equal(read.site_name, 'Kon10')
})

test('the studio:access gate denies an anonymous (cookieless) caller', async () => {
  await assert.rejects(
    () => rpc(config, { action: 'list', slug: 'posts' }),
    AccessDeniedError,
  )
  await assert.rejects(
    () => rpc(config, { action: 'create', slug: 'posts', data: { title: 'Nope' } }),
    AccessDeniedError,
  )
})
