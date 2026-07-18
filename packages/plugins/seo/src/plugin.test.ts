import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fieldRegistry,
  type AnyEntity,
  type FieldTypeEntry,
  type HookFn,
  type Kon10Instance,
} from 'kon10'
import { seoPlugin } from './plugin.js'
import { seoFieldConfigSchema, socialFieldConfigSchema } from './field.js'

const userHook: HookFn = ({ data }) => data

// Explicit opt-in: a seo() field + a socialGraph() field, in their own groups.
const posts: AnyEntity = {
  slug: 'posts',
  cardinality: 'many',
  studio: { useAsTitle: 'title' },
  hooks: { beforeCreate: [userHook] },
  fields: [
    { name: 'title', type: 'text' },
    { name: 'excerpt', type: 'text' },
    { name: 'seo', type: 'seo', from: { description: '{excerpt}' } },
    { name: 'social', type: 'socialGraph' },
  ],
}

// Config-injection target — has neither field of its own.
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

// Never injected: not in the inject list.
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
      const type = entry.configSchema.shape.type.value
      if (!fieldRegistry.has(type)) fieldRegistry.register(entry)
    },
  } as unknown as Kon10Instance
}

await seoPlugin({ inject: ['pages'], titleTemplate: '%s · Acme' }).onInit?.(
  fakeCms([posts, pages, plain, tags]),
)

test('registers the seo (search) and socialGraph (OG/Twitter) field types', () => {
  assert.ok(fieldRegistry.has('seo'))
  assert.ok(fieldRegistry.has('socialGraph'))

  const seoSchema = fieldRegistry.buildDocumentSchema([{ name: 'seo', type: 'seo' }])
  assert.equal(seoSchema.safeParse({}).success, true) // never required
  assert.equal(seoSchema.safeParse({ seo: { title: 'Hi', noindex: true } }).success, true)
  assert.equal(seoSchema.safeParse({ seo: { canonical: 'not-a-url' } }).success, false)

  const socialSchema = fieldRegistry.buildDocumentSchema([{ name: 'social', type: 'socialGraph' }])
  assert.equal(socialSchema.safeParse({ social: { ogTitle: 'Hi', twitterCard: 'summary' } }).success, true)
  assert.equal(socialSchema.safeParse({ social: { twitterCard: 'nope' } }).success, false)
})

test('resolves and stamps `from`: field value wins, entity default fills the rest', () => {
  const field = posts.fields.find((f) => f.name === 'seo') as Record<string, unknown>
  assert.deepEqual(field.from, { title: '{title}', description: '{excerpt}' })
  assert.equal(field.titleTemplate, '%s · Acme')
})

test('cross-links the socialGraph field to its sibling seo field', () => {
  const social = posts.fields.find((f) => f.name === 'social') as Record<string, unknown>
  assert.equal(social.seoField, 'seo')
})

test('appends derivation hooks after user hooks, on seo-carrying entities only', () => {
  assert.equal(posts.hooks?.beforeCreate?.length, 2)
  assert.equal(posts.hooks?.beforeCreate?.[0], userHook) // appended, not unshifted
  assert.equal(posts.hooks?.beforeUpdate?.length, 1)
})

test('injects both seo and socialGraph into listed entities that lack them', () => {
  const seoField = pages.fields.find((f) => (f as Record<string, unknown>).type === 'seo') as Record<string, unknown>
  const socialField = pages.fields.find((f) => (f as Record<string, unknown>).type === 'socialGraph') as Record<string, unknown>
  assert.ok(seoField)
  assert.ok(socialField)
  assert.equal((seoField.meta as Record<string, unknown>).group, 'SEO')
  assert.equal((socialField.meta as Record<string, unknown>).group, 'Social Graph')
  assert.equal(socialField.seoField, 'seo')
  assert.deepEqual(seoField.from, { title: '{title}' })
  assert.equal(pages.hooks?.beforeCreate?.length, 1)
})

test('social:false injects only the seo field', () => {
  const noSocial: AnyEntity = { slug: 'faqs', cardinality: 'many', fields: [{ name: 'title', type: 'text' }] }
  seoPlugin({ inject: ['faqs'], social: false }).onInit?.(fakeCms([noSocial]))
  assert.ok(noSocial.fields.find((f) => (f as Record<string, unknown>).type === 'seo'))
  assert.equal(noSocial.fields.find((f) => (f as Record<string, unknown>).type === 'socialGraph'), undefined)
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

test('config schemas accept bare fields and the full option set', () => {
  assert.equal(seoFieldConfigSchema.safeParse({ type: 'seo' }).success, true)
  assert.equal(
    seoFieldConfigSchema.safeParse({ type: 'seo', from: { title: '{title}' }, titleTemplate: '%s', robots: true, maxTitleLength: 70 }).success,
    true,
  )
  assert.equal(socialFieldConfigSchema.safeParse({ type: 'socialGraph' }).success, true)
  assert.equal(socialFieldConfigSchema.safeParse({ type: 'socialGraph', seoField: 'seo', maxTitleLength: 70 }).success, true)
})
