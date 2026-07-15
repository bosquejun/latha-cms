import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fieldRegistry,
  type AnyEntity,
  type FieldTypeEntry,
  type HookFn,
  type Kon10Instance,
} from '@kon10/core'
import { seoPlugin } from './plugin.js'
import { seoFieldConfigSchema } from './field.js'

const userHook: HookFn = ({ data }) => data

// Explicit opt-in via a seo() field, with a hand-written `from`.
const posts: AnyEntity = {
  slug: 'posts',
  cardinality: 'many',
  studio: { useAsTitle: 'title' },
  hooks: { beforeCreate: [userHook] },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'excerpt', type: 'text' },
    { name: 'seo', type: 'seo', from: { description: '{excerpt}' } },
  ],
}

// Config-injection target — has no seo field of its own.
const pages: AnyEntity = {
  slug: 'pages',
  cardinality: 'many',
  fields: [{ name: 'title', type: 'text' }],
}

// A hand-rolled group *named* seo must be left completely alone.
const plain: AnyEntity = {
  slug: 'plain',
  cardinality: 'many',
  fields: [{ name: 'seo', type: 'group', fields: [] }],
}

// Never injected: not in the inject list and carries no seo field.
const tags: AnyEntity = {
  slug: 'tags',
  cardinality: 'many',
  fields: [{ name: 'name', type: 'text' }],
}

function fakeCms(entities: AnyEntity[]): Kon10Instance {
  return {
    entities,
    db: {},
    registerFieldType: (entry: FieldTypeEntry) => {
      if (!fieldRegistry.has('seo')) fieldRegistry.register(entry)
    },
  } as unknown as Kon10Instance
}

await seoPlugin({ inject: ['pages'], titleTemplate: '%s · Acme' }).onInit?.(
  fakeCms([posts, pages, plain, tags]),
)

test('registers the seo field type with an object data schema', () => {
  assert.ok(fieldRegistry.has('seo'))
  const built = fieldRegistry.buildDocumentSchema([{ name: 'seo', type: 'seo' }])
  assert.equal(built.safeParse({}).success, true) // never required
  assert.equal(built.safeParse({ seo: { title: 'Hi', noindex: true } }).success, true)
  assert.equal(built.safeParse({ seo: { canonical: 'not-a-url' } }).success, false)
})

test('resolves and stamps `from`: field value wins, entity default fills the rest', () => {
  const field = posts.fields.find((f) => f.name === 'seo') as Record<string, unknown>
  // title inferred from the entity; description kept from the hand-written `from`.
  assert.deepEqual(field.from, { title: '{title}', description: '{excerpt}' })
  assert.equal(field.titleTemplate, '%s · Acme')
})

test('appends derivation hooks after user hooks, on seo-carrying entities only', () => {
  assert.equal(posts.hooks?.beforeCreate?.length, 2)
  assert.equal(posts.hooks?.beforeCreate?.[0], userHook) // appended, not unshifted
  assert.equal(posts.hooks?.beforeUpdate?.length, 1)
})

test('injects a seo field into listed entities that lack one', () => {
  const injected = pages.fields.find((f) => (f as Record<string, unknown>).type === 'seo') as Record<string, unknown>
  assert.ok(injected)
  assert.equal(injected.name, 'seo')
  assert.deepEqual(injected.from, { title: '{title}' })
  assert.equal(pages.hooks?.beforeCreate?.length, 1)
})

test('leaves a hand-rolled group named seo untouched', () => {
  const field = plain.fields.find((f) => f.name === 'seo') as Record<string, unknown>
  assert.equal(field.type, 'group')
  assert.equal(field.from, undefined)
  assert.equal(plain.hooks, undefined)
})

test('does not inject into entities outside the inject list', () => {
  assert.equal(tags.fields.length, 1)
  assert.equal(tags.hooks, undefined)
})

test('config schema accepts a bare seo field and the full option set', () => {
  assert.equal(seoFieldConfigSchema.safeParse({ type: 'seo' }).success, true)
  assert.equal(
    seoFieldConfigSchema.safeParse({
      type: 'seo',
      from: { title: '{title}' },
      titleTemplate: '%s',
      social: false,
      robots: true,
      maxTitleLength: 70,
    }).success,
    true,
  )
})
