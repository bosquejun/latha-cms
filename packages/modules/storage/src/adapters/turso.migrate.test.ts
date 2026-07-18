/**
 * Live additive-migration coverage against in-memory libsql: a table created
 * from schema v1 gains v2's new columns on the next migrate — pre-existing
 * rows read back with the new field null, new rows can set and filter on it.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stampFields, text, boolean, type Entity } from '@kon10/core'
import { tursoAdapter } from './turso.js'

const v1: Entity = {
  cardinality: 'many',
  slug: 'posts',
  fields: stampFields({ title: text({ required: true }) }),
}

const v2: Entity = {
  cardinality: 'many',
  slug: 'posts',
  fields: stampFields({
    title: text({ required: true }),
    status: text(),
    featured: boolean(),
  }),
}

test('adding fields to a live table materializes as nullable columns', async () => {
  const db = tursoAdapter({ url: ':memory:' })
  await db.connect?.()

  await db.migrate([v1])
  const old = await db.create('posts', { title: 'v1 row' })

  // Same process keeps the connection (in-memory db) — a second migrate is
  // exactly what a redeploy with the new config does against a persistent db.
  await db.migrate([v2])

  const fresh = await db.create('posts', { title: 'v2 row', status: 'published', featured: true })
  assert.equal(fresh.status, 'published')
  assert.equal(fresh.featured, true)

  const oldBack = await db.findOne('posts', old.id)
  assert.ok(oldBack)
  assert.equal(oldBack.status ?? null, null)

  const published = await db.find('posts', { where: { status: 'published' } })
  assert.deepEqual(published.map((d) => d.title), ['v2 row'])
  assert.equal(await db.count('posts', { where: { status: 'published' } }), 1)

  await db.disconnect?.()
})
