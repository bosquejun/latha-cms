import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fieldRegistry,
  type AnyEntity,
  type FieldTypeEntry,
  type HookFn,
  type LathaInstance,
} from '@latha/core'
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

function fakeCms(entities: AnyEntity[]): LathaInstance {
  return {
    entities,
    db: {},
    registerFieldType: (entry: FieldTypeEntry) => fieldRegistry.register(entry),
  } as unknown as LathaInstance
}

// One boot for the whole file: the field registry is a process-wide singleton,
// so registering 'slug' twice would throw.
await slugPlugin().onInit?.(fakeCms([posts, plain]))

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
