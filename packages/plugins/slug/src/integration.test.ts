/**
 * Slug plugin end-to-end through a real bootstrap: unlike `hooks.test.ts` (which
 * calls the hook functions in isolation), this wires `slugPlugin()` into a live
 * `ContentModule` and drives the full `operations` pipeline (validation → hooks
 * → DB). It proves the plugin's field-type registration, generation, collision
 * suffixing, and nested-page path derivation + descendant cascade all hold when
 * the kernel invokes the hooks — the integration seam the isolated unit can't
 * cover.
 */

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  bootstrapKon10,
  defineConfig,
  operations,
  silentLogger,
  type DBAdapter,
  type Doc,
  type Kon10Instance,
  type Query,
} from '@kon10/core'
import { Collection, ContentModule, relationship, text } from '@kon10/content'
import { slug } from './builders.js'
import { slugPlugin } from './plugin.js'

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
      const rows = [...table(slug).values()].filter((d) => matches(d, query?.where))
      const offset = query?.offset ?? 0
      return rows.slice(offset, query?.limit != null ? offset + query.limit : undefined)
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

let cms: Kon10Instance

before(async () => {
  const config = defineConfig({
    db: memoryAdapter(),
    logger: silentLogger,
    plugins: [slugPlugin()],
    modules: [
      ContentModule({
        entities: [
          Collection({
            slug: 'posts',
            fields: {
              title: text({ required: true }),
              slug: slug({ from: '{title}' }),
            },
          }),
          Collection({
            slug: 'pages',
            fields: {
              title: text({ required: true }),
              parent: relationship({ to: 'pages' }),
              slug: slug({ from: '{title}', nested: { parent: 'parent' } }),
            },
          }),
        ],
      }),
    ],
  })
  cms = await bootstrapKon10(config)
})

const ctx = () => ({ cms })
const createPost = (data: Record<string, unknown>) => operations.create(ctx(), 'posts', data)
const createPage = (data: Record<string, unknown>) => operations.create(ctx(), 'pages', data)

test('the plugin generates a slug from the title and suffixes collisions', async () => {
  const first = await createPost({ title: 'Hello World' })
  assert.equal(first.slug, 'hello-world')

  const second = await createPost({ title: 'Hello World' })
  assert.equal(second.slug, 'hello-world-2')

  const third = await createPost({ title: 'Hello World' })
  assert.equal(third.slug, 'hello-world-3')
})

test('a manual (already-valid) slug wins over generation', async () => {
  // Through the full pipeline, Zod validation runs before the slug hook, so a
  // manual value must already satisfy the slug field's kebab pattern — an
  // unnormalized value (spaces/caps) is rejected at validation, not silently
  // fixed up (that normalization is only reachable in the isolated hook unit).
  const post = await createPost({ title: 'Different Title', slug: 'chosen-one' })
  assert.equal(post.slug, 'chosen-one')

  await assert.rejects(() => createPost({ title: 'Bad', slug: 'Not Kebab' }))
})

test('nested pages derive a path from the parent chain', async () => {
  const docs = await createPage({ title: 'Docs' })
  assert.equal(docs.slug, 'docs')
  assert.equal(docs.path, 'docs')

  const setup = await createPage({ title: 'Setup', parent: docs.id })
  assert.equal(setup.slug, 'setup')
  assert.equal(setup.path, 'docs/setup')

  const linux = await createPage({ title: 'Linux', parent: setup.id })
  assert.equal(linux.path, 'docs/setup/linux')
})

test('renaming an ancestor cascades the path to all descendants', async () => {
  const guides = await createPage({ title: 'Guides' })
  const install = await createPage({ title: 'Install', parent: guides.id })
  const macos = await createPage({ title: 'macOS', parent: install.id })
  assert.equal(macos.path, 'guides/install/macos')

  // Rename the root's leaf: guides → handbook.
  const renamed = await operations.update(ctx(), 'pages', guides.id, { slug: 'handbook' })
  assert.equal(renamed.path, 'handbook')

  // afterUpdate cascades the new prefix through the subtree.
  const installAfter = await operations.findOne(ctx(), 'pages', install.id)
  const macosAfter = await operations.findOne(ctx(), 'pages', macos.id)
  assert.equal(installAfter!.path, 'handbook/install')
  assert.equal(macosAfter!.path, 'handbook/install/macos')
})
