/**
 * Live marshaling round-trips against in-memory libsql: every stored column
 * kind (text, integer, real, boolean, date→ISO text, JSON array, JSON object)
 * survives a create → read cycle through real SQLite, and an explicit `null`
 * on update clears a column. Complements `turso.migrate.test.ts` (schema
 * evolution) and `schema/marshal.ts`'s pure conversion units by proving the
 * conversions hold end-to-end through the adapter's SQL.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { array, boolean, date, group, number, stampFields, text, type Entity } from '@kon10/core'
import { tursoAdapter } from './turso.js'

const things: Entity = {
  cardinality: 'many',
  slug: 'things',
  fields: stampFields({
    name: text(),
    count: number({ integer: true }),
    ratio: number(),
    active: boolean(),
    when: date(),
    labels: array({ fields: { v: text() } }),
    meta: group({ fields: { k: text() } }),
  }),
}

test('every column kind round-trips through real SQLite', async () => {
  const db = tursoAdapter({ url: ':memory:' })
  await db.connect?.()
  await db.migrate([things])

  const when = new Date('2020-01-02T03:04:05.000Z')
  const created = await db.create('things', {
    name: 'widget',
    count: 42,
    ratio: 3.5,
    active: true,
    when,
    labels: [{ v: 'a' }, { v: 'b' }],
    meta: { k: 'val' },
  })

  const doc = await db.findOne('things', created.id)
  assert.ok(doc)
  assert.equal(doc.name, 'widget')
  assert.equal(doc.count, 42) // INTEGER
  assert.equal(doc.ratio, 3.5) // REAL
  assert.equal(doc.active, true) // 1 → true
  assert.equal(doc.when, when.toISOString()) // Date stored as ISO text
  assert.deepEqual(doc.labels, [{ v: 'a' }, { v: 'b' }]) // JSON array
  assert.deepEqual(doc.meta, { k: 'val' }) // JSON object

  await db.disconnect?.()
})

test('a boolean false stores as 0 and reads back false', async () => {
  const db = tursoAdapter({ url: ':memory:' })
  await db.connect?.()
  await db.migrate([things])

  const created = await db.create('things', { name: 'off', active: false })
  const doc = await db.findOne('things', created.id)
  assert.equal(doc!.active, false)

  await db.disconnect?.()
})

test('an explicit null on update clears a column', async () => {
  const db = tursoAdapter({ url: ':memory:' })
  await db.connect?.()
  await db.migrate([things])

  const created = await db.create('things', { name: 'clearme', count: 5, active: true })
  assert.equal(created.count, 5)

  const updated = await db.update('things', created.id, { count: null, active: null })
  assert.equal(updated.count, null)
  assert.equal(updated.active, null)

  await db.disconnect?.()
})
