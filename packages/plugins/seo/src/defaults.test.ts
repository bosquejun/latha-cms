import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AnyEntity } from '@kon10/core'
import { inferFrom } from './defaults.js'

const entity = (fields: Array<Record<string, unknown>>, studio?: Record<string, unknown>): AnyEntity =>
  ({ slug: 'x', cardinality: 'many', fields, studio } as unknown as AnyEntity)

test('infers title from a `title` field and description from an `excerpt`', () => {
  assert.deepEqual(
    inferFrom(entity([{ name: 'title', type: 'text' }, { name: 'excerpt', type: 'text' }])),
    { title: '{title}', description: '{excerpt}' },
  )
})

test('prefers the entity studio.useAsTitle when it names a text field', () => {
  assert.deepEqual(
    inferFrom(entity([{ name: 'headline', type: 'text' }], { useAsTitle: 'headline' })),
    { title: '{headline}' },
  )
})

test('ignores non-text fields and yields nothing when no candidate matches', () => {
  assert.deepEqual(inferFrom(entity([{ name: 'title', type: 'media' }])), {})
  assert.deepEqual(inferFrom(entity([{ name: 'count', type: 'number' }])), {})
})
