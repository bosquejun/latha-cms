/**
 * Entity-factory coverage for the drafts workflow: `Collection()` stamps the
 * implicit `status` field and the published-only delivery constraint, defers
 * to a user-declared `status`, and turns both off with `drafts: false`.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { text, select, z } from '@latha/core'
import { Collection, Document, Taxonomy } from './entities.js'

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

test('Collection cache composes with the drafts where constraint', () => {
  const posts = Collection({
    slug: 'posts',
    cache: { ttlSeconds: 3600 },
    fields: { title: text({ required: true }) },
  })
  assert.deepEqual(posts.api, { where: { status: 'published' }, cache: { ttlSeconds: 3600 } })
})

test('Collection cache: false composes independently of drafts: false', () => {
  const products = Collection({
    slug: 'products',
    drafts: false,
    cache: false,
    fields: { name: text({ required: true }) },
  })
  assert.deepEqual(products.api, { cache: false })
})

test('Document exposes a cache override, and stays unset by default', () => {
  const withCache = Document({
    slug: 'site-settings',
    cache: { ttlSeconds: 3600 },
    fields: { title: text({ required: true }) },
  })
  assert.deepEqual(withCache.api, { cache: { ttlSeconds: 3600 } })

  const withoutCache = Document({ slug: 'site-settings', fields: { title: text({ required: true }) } })
  assert.equal(withoutCache.api, undefined)
})

test('Taxonomy exposes a cache override, and stays unset by default', () => {
  const withCache = Taxonomy({ slug: 'categories', cache: false })
  assert.deepEqual(withCache.api, { cache: false })

  const withoutCache = Taxonomy({ slug: 'categories' })
  assert.equal(withoutCache.api, undefined)
})
