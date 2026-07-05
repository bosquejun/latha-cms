import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { DBAdapter, Doc } from '@latha/core'
import { createSlugHooks, ensureUniqueSlug } from './hooks.js'
import { compileTokens, parseTemplate } from './template.js'

const postFields = [
  { name: 'title', type: 'text' },
  { name: 'category', type: 'taxonomy', to: 'categories' },
]

/** In-memory DBAdapter over per-collection arrays with equality-map where. */
function fakeDb(tables: Record<string, Doc[]>): DBAdapter {
  return {
    async find(collection, query) {
      const rows = tables[collection] ?? []
      const where = query?.where ?? {}
      const hits = rows.filter((row) =>
        Object.entries(where).every(([k, v]) => row[k] === v),
      )
      return query?.limit !== undefined ? hits.slice(0, query.limit) : hits
    },
    async findOne(collection, id) {
      return (tables[collection] ?? []).find((row) => row.id === id) ?? null
    },
    async count(collection, query) {
      return (await this.find(collection, query)).length
    },
    async create() {
      throw new Error('unused')
    },
    async update() {
      throw new Error('unused')
    },
    async delete() {},
    async migrate() {},
  }
}

const titleTokens = compileTokens(parseTemplate('{title}'), postFields, 'posts.slug')

function hooksFor(db: DBAdapter, targets = [{ name: 'slug', tokens: titleTokens }]) {
  return createSlugHooks(db, 'posts', targets)
}

const hookArgs = { principal: null, operation: 'create' as const, slug: 'posts' }

test('beforeCreate generates a unique slug from the template', async () => {
  const { beforeCreate } = hooksFor(fakeDb({ posts: [] }))
  const out = await beforeCreate({ ...hookArgs, data: { title: 'Hello World' } })
  assert.equal(out.slug, 'hello-world')
})

test('beforeCreate lets a manual value win, normalized', async () => {
  const { beforeCreate } = hooksFor(fakeDb({ posts: [] }))
  const out = await beforeCreate({
    ...hookArgs,
    data: { title: 'Hello World', slug: 'My Custom/Path Here' },
  })
  assert.equal(out.slug, 'my-custom/path-here')
})

test('beforeCreate suffixes -2, -3 on collisions', async () => {
  const db = fakeDb({
    posts: [
      { id: 'a', slug: 'hello-world' },
      { id: 'b', slug: 'hello-world-2' },
    ],
  })
  const { beforeCreate } = hooksFor(db)
  const out = await beforeCreate({ ...hookArgs, data: { title: 'Hello World' } })
  assert.equal(out.slug, 'hello-world-3')
})

test('beforeCreate leaves the field unset when the template resolves empty', async () => {
  const { beforeCreate } = hooksFor(fakeDb({ posts: [] }))
  const out = await beforeCreate({ ...hookArgs, data: { title: 'こんにちは' } })
  assert.equal('slug' in out, false)
})

test('beforeUpdate skips entirely when the payload has no slug key', async () => {
  const { beforeUpdate } = hooksFor(fakeDb({ posts: [] }))
  const out = await beforeUpdate({
    ...hookArgs,
    operation: 'update',
    data: { title: 'Renamed Title' },
    previousDoc: { id: 'a', title: 'Old', slug: 'old-slug' },
  })
  assert.equal('slug' in out, false)
})

test('beforeUpdate keeps the doc own slug without treating it as a collision', async () => {
  const db = fakeDb({ posts: [{ id: 'a', slug: 'hello-world' }] })
  const { beforeUpdate } = hooksFor(db)
  const out = await beforeUpdate({
    ...hookArgs,
    operation: 'update',
    data: { title: 'Hello World', slug: 'hello-world' },
    previousDoc: { id: 'a', title: 'Hello World', slug: 'hello-world' },
  })
  assert.equal(out.slug, 'hello-world')
})

test('beforeUpdate suffixes when the new slug collides with another doc', async () => {
  const db = fakeDb({
    posts: [
      { id: 'a', slug: 'old-slug' },
      { id: 'b', slug: 'taken' },
    ],
  })
  const { beforeUpdate } = hooksFor(db)
  const out = await beforeUpdate({
    ...hookArgs,
    operation: 'update',
    data: { slug: 'taken' },
    previousDoc: { id: 'a', slug: 'old-slug' },
  })
  assert.equal(out.slug, 'taken-2')
})

test('ensureUniqueSlug respects maxLength when suffixing', async () => {
  const db = fakeDb({ posts: [{ id: 'a', slug: 'abcdefgh' }] })
  const out = await ensureUniqueSlug(db, 'posts', 'slug', 'abcdefgh', undefined, 8)
  assert.equal(out, 'abcdef-2')
  assert.equal(out.length <= 8, true)
})

test('ensureUniqueSlug falls back to a timestamp suffix after 50 collisions', async () => {
  const rows: Doc[] = [{ id: 'x0', slug: 'base' }]
  for (let n = 2; n <= 50; n++) rows.push({ id: `x${n}`, slug: `base-${n}` })
  const out = await ensureUniqueSlug(fakeDb({ posts: rows }), 'posts', 'slug', 'base')
  assert.match(out, /^base-[a-z0-9]+$/)
  assert.equal(rows.some((r) => r.slug === out), false)
})
