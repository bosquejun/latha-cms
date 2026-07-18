import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fieldRegistry,
  type AnyEntity,
  type FieldTypeEntry,
  type HookFn,
  type Kon10Instance,
} from 'kon10'
import { slugFieldConfigSchema } from './field.js'
import { slugPlugin } from './plugin.js'

const userHook: HookFn = ({ data }) => data

const posts: AnyEntity = {
  slug: 'posts',
  cardinality: 'many',
  hooks: { beforeCreate: [userHook] },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'slug', type: 'slug', from: '{title}', unique: true },
  ],
}

const plain: AnyEntity = {
  slug: 'plain',
  cardinality: 'many',
  // a hand-rolled text field *named* slug must not attract hooks
  fields: [{ name: 'slug', type: 'text' }],
}

const pages: AnyEntity = {
  slug: 'pages',
  cardinality: 'many',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'parent', type: 'relationship', to: 'pages' },
    { name: 'slug', type: 'slug', from: '{title}', unique: false, nested: { parent: 'parent' } },
  ],
}

function fakeCms(entities: AnyEntity[]): Kon10Instance {
  return {
    entities,
    db: {},
    // The field registry is a process-wide singleton — tolerate re-boots so
    // the misconfiguration tests below can run onInit against fresh entities.
    registerFieldType: (entry: FieldTypeEntry) => {
      if (!fieldRegistry.has('slug')) fieldRegistry.register(entry)
    },
  } as unknown as Kon10Instance
}

// One boot for the whole file's happy-path assertions.
await slugPlugin().onInit?.(fakeCms([posts, plain, pages]))

test('onInit registers the slug field type with the path-regex data schema', () => {
  assert.ok(fieldRegistry.has('slug'))
  const built = fieldRegistry.buildDocumentSchema([
    { name: 'slug', type: 'slug', from: '{title}' },
  ])
  assert.equal(built.safeParse({ slug: '2026/07/hello-world-2' }).success, true)
  assert.equal(built.safeParse({ slug: 'Hello World' }).success, false)
  assert.equal(built.safeParse({}).success, true) // never required
})

test('onInit stamps compiled tokens onto the slug field config', () => {
  const field = posts.fields.find((f) => f.name === 'slug') as Record<string, unknown>
  assert.deepEqual(field.tokens, [{ kind: 'field', name: 'title', format: undefined }])
})

test('onInit unshifts hooks ahead of user hooks, only on slug-carrying entities', () => {
  assert.equal(posts.hooks?.beforeCreate?.length, 2)
  assert.equal(posts.hooks?.beforeCreate?.[1], userHook)
  assert.equal(posts.hooks?.beforeUpdate?.length, 1)
  assert.equal(plain.hooks, undefined)
})

test('config schema requires a from template', () => {
  assert.equal(slugFieldConfigSchema.safeParse({ type: 'slug' }).success, false)
  assert.equal(slugFieldConfigSchema.safeParse({ type: 'slug', from: '{title}' }).success, true)
})

// ---------------------------------------------------------------------------
// Nested mode wiring.
// ---------------------------------------------------------------------------

test('nested onInit injects the hidden unique path field and stamps the config', () => {
  const path = pages.fields.find((f) => f.name === 'path') as Record<string, unknown>
  assert.deepEqual(path, { name: 'path', type: 'text', unique: true, meta: { hidden: true } })

  const field = pages.fields.find((f) => f.name === 'slug') as Record<string, unknown>
  assert.equal(field.unique, false)
  assert.deepEqual(field.nested, { parent: 'parent', pathField: 'path', to: 'pages' })
  assert.equal(pages.hierarchical, true)
  assert.equal(pages.hooks?.afterUpdate?.length, 1)
})

test('nested data schema accepts only a single leaf segment', () => {
  const built = fieldRegistry.buildDocumentSchema([
    { name: 'slug', type: 'slug', from: '{title}', nested: { parent: 'parent' } },
  ])
  assert.equal(built.safeParse({ slug: 'hello-world' }).success, true)
  assert.equal(built.safeParse({ slug: 'a/b' }).success, false)
})

function nestedEntity(overrides: Partial<Record<string, unknown>>[]): AnyEntity {
  return {
    slug: 'tree',
    cardinality: 'many',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'parent', type: 'relationship', to: 'tree' },
      { name: 'slug', type: 'slug', from: '{title}', unique: false, nested: { parent: 'parent' } },
      ...overrides,
    ] as AnyEntity['fields'],
  }
}

test('nested onInit rejects misconfiguration at boot', async () => {
  const boot = (entity: AnyEntity) => slugPlugin().onInit?.(fakeCms([entity]))

  const missingParent = nestedEntity([])
  missingParent.fields = missingParent.fields.filter((f) => f.name !== 'parent')
  await assert.rejects(async () => boot(missingParent), /parent field "parent" does not exist/)

  const wrongTarget = nestedEntity([])
  ;(wrongTarget.fields[1] as Record<string, unknown>).to = 'other'
  await assert.rejects(async () => boot(wrongTarget), /self-referential/)

  const manyParent = nestedEntity([])
  ;(manyParent.fields[1] as Record<string, unknown>).many = true
  await assert.rejects(async () => boot(manyParent), /single-valued/)

  const takenPath = nestedEntity([{ name: 'path', type: 'text' }])
  await assert.rejects(async () => boot(takenPath), /plugin owns the path field/)

  const uniqueLeaf = nestedEntity([])
  ;(uniqueLeaf.fields[2] as Record<string, unknown>).unique = true
  await assert.rejects(async () => boot(uniqueLeaf), /drop `unique`/)
})
