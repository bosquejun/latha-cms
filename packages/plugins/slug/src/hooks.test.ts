import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { DBAdapter, Doc, Kon10Instance } from 'kon10'
import {
  createSlugHooks,
  ensureUniqueSlug,
  resolveAncestorPath,
  type SlugHookTarget,
} from './hooks.js'
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
    async update(collection, id, data) {
      const row = (tables[collection] ?? []).find((r) => r.id === id)
      if (!row) throw new Error(`missing ${collection}/${id}`)
      Object.assign(row, data)
      return row
    },
    async delete() {},
    async migrate() {},
  }
}

const titleTokens = compileTokens(parseTemplate('{title}'), postFields, 'posts.slug')

function hooksFor(db: DBAdapter, targets = [{ name: 'slug', tokens: titleTokens }]) {
  return createSlugHooks(db, 'posts', targets)
}

// These hooks close over `db` directly (see hooks.ts's doc comment) and never
// read `cms` — a stub satisfies the type without needing a real instance.
const hookArgs = {
  principal: null,
  operation: 'create' as const,
  slug: 'posts',
  cms: {} as unknown as Kon10Instance,
}

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

// ---------------------------------------------------------------------------
// Nested mode — leaf slug + derived path with parent prefix.
// ---------------------------------------------------------------------------

const pageFields = [
  { name: 'title', type: 'text' },
  { name: 'parent', type: 'relationship', to: 'pages' },
]
const pageTokens = compileTokens(parseTemplate('{title}'), pageFields, 'pages.slug')
const nestedTarget: SlugHookTarget = {
  name: 'slug',
  tokens: pageTokens,
  nested: { parentField: 'parent', pathField: 'path' },
}

function nestedHooks(db: DBAdapter) {
  return createSlugHooks(db, 'pages', [nestedTarget])
}

/** A three-level tree: /docs → /docs/setup → /docs/setup/linux. */
function pageTree(): Doc[] {
  return [
    { id: 'docs', title: 'Docs', slug: 'docs', parent: null, path: 'docs' },
    { id: 'setup', title: 'Setup', slug: 'setup', parent: 'docs', path: 'docs/setup' },
    { id: 'linux', title: 'Linux', slug: 'linux', parent: 'setup', path: 'docs/setup/linux' },
  ]
}

test('nested create: root page gets leaf slug and path equal to it', async () => {
  const { beforeCreate } = nestedHooks(fakeDb({ pages: [] }))
  const out = await beforeCreate({ ...hookArgs, slug: 'pages', data: { title: 'Docs' } })
  assert.equal(out.slug, 'docs')
  assert.equal(out.path, 'docs')
})

test('nested create: child path is prefixed by the parent chain', async () => {
  const { beforeCreate } = nestedHooks(fakeDb({ pages: pageTree() }))
  const out = await beforeCreate({
    ...hookArgs,
    slug: 'pages',
    data: { title: 'Windows', parent: 'setup' },
  })
  assert.equal(out.slug, 'windows')
  assert.equal(out.path, 'docs/setup/windows')
})

test('nested create: leaf collides only among siblings, and folds slashes', async () => {
  const pages = pageTree()
  const { beforeCreate } = nestedHooks(fakeDb({ pages }))
  // Same leaf under a different parent is fine.
  const elsewhere = await beforeCreate({
    ...hookArgs,
    slug: 'pages',
    data: { title: 'Setup', parent: 'setup' },
  })
  assert.equal(elsewhere.slug, 'setup')
  assert.equal(elsewhere.path, 'docs/setup/setup')
  // Same leaf under the same parent suffixes.
  const sibling = await beforeCreate({
    ...hookArgs,
    slug: 'pages',
    data: { title: 'Setup', parent: 'docs' },
  })
  assert.equal(sibling.slug, 'setup-2')
  assert.equal(sibling.path, 'docs/setup-2')
  // Manual multi-segment input folds to a single segment.
  const manual = await beforeCreate({
    ...hookArgs,
    slug: 'pages',
    data: { title: 'X', slug: 'a/b c', parent: 'docs' },
  })
  assert.equal(manual.slug, 'a-b-c')
})

test('nested create: client-sent path is stripped and recomputed', async () => {
  const { beforeCreate } = nestedHooks(fakeDb({ pages: pageTree() }))
  const out = await beforeCreate({
    ...hookArgs,
    slug: 'pages',
    data: { title: 'Windows', parent: 'docs', path: 'evil/override' },
  })
  assert.equal(out.path, 'docs/windows')
})

test('nested update: changing the parent recomputes the path with the slug key absent', async () => {
  const { beforeUpdate } = nestedHooks(fakeDb({ pages: pageTree() }))
  const out = await beforeUpdate({
    ...hookArgs,
    slug: 'pages',
    operation: 'update',
    data: { parent: 'docs' },
    previousDoc: { id: 'linux', title: 'Linux', slug: 'linux', parent: 'setup', path: 'docs/setup/linux' },
  })
  assert.equal(out.slug, 'linux')
  assert.equal(out.path, 'docs/linux')
})

test('nested update: payload without slug or parent stays untouched', async () => {
  const { beforeUpdate } = nestedHooks(fakeDb({ pages: pageTree() }))
  const out = await beforeUpdate({
    ...hookArgs,
    slug: 'pages',
    operation: 'update',
    data: { title: 'Renamed', path: 'evil' },
    previousDoc: { id: 'linux', slug: 'linux', parent: 'setup', path: 'docs/setup/linux' },
  })
  assert.equal('slug' in out, false)
  assert.equal('path' in out, false)
})

test('nested update: re-parenting under a descendant (or itself) throws', async () => {
  const { beforeUpdate } = nestedHooks(fakeDb({ pages: pageTree() }))
  const move = async (parent: string) =>
    beforeUpdate({
      ...hookArgs,
      slug: 'pages',
      operation: 'update',
      data: { parent },
      previousDoc: { id: 'docs', slug: 'docs', parent: null, path: 'docs' },
    })
  await assert.rejects(() => move('linux'), /cannot be nested under itself or its own descendant/)
  await assert.rejects(() => move('docs'), /cannot be nested under itself or its own descendant/)
})

test('nested afterUpdate: a changed path cascades to all descendants', async () => {
  const pages = pageTree()
  const db = fakeDb({ pages })
  const { beforeUpdate, afterUpdate } = nestedHooks(db)
  assert.notEqual(afterUpdate, undefined)
  // Rename the root's slug: docs → guides.
  const before = await beforeUpdate({
    ...hookArgs,
    slug: 'pages',
    operation: 'update',
    data: { slug: 'guides' },
    previousDoc: pages[0],
  })
  const saved = { ...pages[0]!, ...before } as Doc
  Object.assign(pages[0]!, saved)
  await afterUpdate!({
    ...hookArgs,
    slug: 'pages',
    operation: 'update',
    data: saved,
    previousDoc: { id: 'docs', slug: 'docs', parent: null, path: 'docs' },
  })
  assert.equal(pages[1]!.path, 'guides/setup')
  assert.equal(pages[2]!.path, 'guides/setup/linux')
})

test('resolveAncestorPath throws on a dangling parent pointer', async () => {
  const db = fakeDb({ pages: pageTree() })
  await assert.rejects(
    () => resolveAncestorPath(db, 'pages', 'slug', 'parent', 'ghost'),
    /does not exist/,
  )
})
