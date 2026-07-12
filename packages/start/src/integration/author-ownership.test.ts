/**
 * Cross-module RBAC seam: the `posts` ownership `access` predicates + the
 * `beforeCreate` author-default hook, driven through the RPC dispatcher with
 * real login cookies. An `author`-role user (studio:access + posts:create/read,
 * no blanket posts:update) may edit only their own posts; an admin edits any.
 * This interplay is what `apps/playground` relies on and nothing else tests.
 */

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { AccessDeniedError } from '@kon10/core'
import type { ResolvedConfig } from '@kon10/core'
import type { JsonDoc } from '@kon10/studio-sdk'
import { getRuntime } from '../runtime.js'
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AUTHOR_EMAIL,
  AUTHOR_PASSWORD,
  buildTestConfig,
  login,
  memoryAdapter,
  rpc,
} from './fixture.js'

let config: ResolvedConfig
let adminCookie: string
let authorCookie: string
let authorId: string

before(async () => {
  config = buildTestConfig(memoryAdapter())
  adminCookie = await login(config, ADMIN_EMAIL, ADMIN_PASSWORD)
  authorCookie = await login(config, AUTHOR_EMAIL, AUTHOR_PASSWORD)
  const kon10 = await getRuntime(config)
  authorId = (await kon10.db.find('users', { where: { email: AUTHOR_EMAIL }, limit: 1 }))[0]!.id
})

test('beforeCreate forces an author to own their post even if they claim another', async () => {
  const post = (await rpc(
    config,
    { action: 'create', slug: 'posts', data: { title: 'Mine', author: 'someone-else' } },
    authorCookie,
  )) as JsonDoc
  // The author lacks posts:update, so authorship is forced to the creator.
  assert.equal(post.author, authorId)
})

test('an author can update and delete their own post', async () => {
  const post = (await rpc(
    config,
    { action: 'create', slug: 'posts', data: { title: 'Editable' } },
    authorCookie,
  )) as JsonDoc
  assert.equal(post.author, authorId)

  const updated = (await rpc(
    config,
    { action: 'update', slug: 'posts', id: post.id, data: { title: 'Edited' } },
    authorCookie,
  )) as JsonDoc
  assert.equal(updated.title, 'Edited')

  const removed = (await rpc(
    config,
    { action: 'remove', slug: 'posts', id: post.id },
    authorCookie,
  )) as { id: string }
  assert.equal(removed.id, post.id)
})

test("an author cannot update or delete a post they don't own", async () => {
  // Admin creates a post owned by the admin.
  const adminPost = (await rpc(
    config,
    { action: 'create', slug: 'posts', data: { title: 'Admin Owned' } },
    adminCookie,
  )) as JsonDoc
  assert.notEqual(adminPost.author, authorId)

  await assert.rejects(
    () =>
      rpc(
        config,
        { action: 'update', slug: 'posts', id: adminPost.id, data: { title: 'Hijack' } },
        authorCookie,
      ),
    AccessDeniedError,
  )
  await assert.rejects(
    () => rpc(config, { action: 'remove', slug: 'posts', id: adminPost.id }, authorCookie),
    AccessDeniedError,
  )
})

test('an admin can edit a post owned by someone else', async () => {
  const authorPost = (await rpc(
    config,
    { action: 'create', slug: 'posts', data: { title: 'By Author' } },
    authorCookie,
  )) as JsonDoc
  assert.equal(authorPost.author, authorId)

  const updated = (await rpc(
    config,
    { action: 'update', slug: 'posts', id: authorPost.id, data: { title: 'Edited by Admin' } },
    adminCookie,
  )) as JsonDoc
  assert.equal(updated.title, 'Edited by Admin')
})
