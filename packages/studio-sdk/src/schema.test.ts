import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Entity } from 'kon10'
import { describeEntity, labelsOf, singularizeLabel } from './schema.js'

const collection = (slug: string, studio?: Entity['studio']): Entity => ({
  slug,
  cardinality: 'many',
  fields: [],
  studio,
})

test('singularizeLabel handles common Studio collection names', () => {
  assert.equal(singularizeLabel('Posts'), 'Post')
  assert.equal(singularizeLabel('Categories'), 'Category')
  assert.equal(singularizeLabel('Statuses'), 'Status')
})

test('labelsOf prefers explicit singular and plural labels', () => {
  assert.deepEqual(
    labelsOf(collection('media', {
      labels: { singular: 'Media item', plural: 'Media Library', empty: 'Media items' },
    })),
    { singular: 'Media item', plural: 'Media Library', empty: 'Media items' },
  )
})

test('describeEntity carries both labels to form and list consumers', () => {
  const descriptor = describeEntity({ ...collection('categories'), hierarchical: true })

  assert.equal(descriptor.label, 'Categories')
  assert.equal(descriptor.singularLabel, 'Category')
  assert.equal(descriptor.pluralLabel, 'Categories')
  assert.equal(descriptor.emptyLabel, 'Categories')
  assert.equal(descriptor.hierarchical, true)
})
