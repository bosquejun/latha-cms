/**
 * Entity-factory coverage for the drafts workflow: `Collection()` stamps the
 * implicit `status` field and the published-only delivery constraint, defers
 * to a user-declared `status`, and turns both off with `drafts: false`.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { text, select, z } from '@latha/core'
import { Collection } from './entities.js'

test('Collection defaults to the drafts workflow', () => {
  const posts = Collection({ slug: 'posts', fields: { title: text({ required: true }) } })
  const status = posts.fields.find((f) => f.name === 'status')
  assert.ok(status, 'implicit status field stamped')
  assert.equal(status.type, 'select')
  assert.equal((status as { defaultValue?: unknown }).defaultValue, 'draft')
  assert.deepEqual(posts.api, { where: { status: 'published' } })
})

test('a user-declared status field is kept, the constraint still applies', () => {
  const posts = Collection({
    slug: 'posts',
    fields: {
      title: text({ required: true }),
      status: select({
        options: z.enum(['draft', 'published', 'archived']),
        defaultValue: 'draft',
      }),
    },
  })
  const statuses = posts.fields.filter((f) => f.name === 'status')
  assert.equal(statuses.length, 1)
  assert.deepEqual(posts.api, { where: { status: 'published' } })
})

test('drafts: false opts out entirely', () => {
  const products = Collection({
    slug: 'products',
    drafts: false,
    fields: { name: text({ required: true }) },
  })
  assert.equal(products.fields.some((f) => f.name === 'status'), false)
  assert.equal(products.api, undefined)
})
