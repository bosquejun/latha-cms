/**
 * Live query behavior against in-memory libsql: WHERE equality (including a
 * marshaled boolean), `count` with a filter, ORDER BY asc/desc, LIMIT/OFFSET
 * pagination, and `findOne` on a missing id. These exercise `buildSelect` /
 * `buildWhere` against real SQLite rather than asserting on generated SQL.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boolean, number, stampFields, text, type Entity } from '@kon10/core'
import { tursoAdapter } from './turso.js'

const items: Entity = {
  cardinality: 'many',
  slug: 'items',
  fields: stampFields({
    name: text(),
    n: number({ integer: true }),
    active: boolean(),
  }),
}

async function seeded() {
  const db = tursoAdapter({ url: ':memory:' })
  await db.connect?.()
  await db.migrate([items])
  await db.create('items', { name: 'a', n: 3, active: true })
  await db.create('items', { name: 'b', n: 1, active: false })
  await db.create('items', { name: 'c', n: 2, active: true })
  return db
}

test('find applies WHERE equality, including a marshaled boolean', async () => {
  const db = await seeded()

  const byName = await db.find('items', { where: { name: 'b' } })
  assert.equal(byName.length, 1)
  assert.equal(byName[0]!.n, 1)

  const activeOnly = await db.find('items', { where: { active: true } })
  assert.deepEqual(activeOnly.map((d) => d.name).sort(), ['a', 'c'])

  await db.disconnect?.()
})

test('count respects the same WHERE filter as find', async () => {
  const db = await seeded()
  assert.equal(await db.count('items'), 3)
  assert.equal(await db.count('items', { where: { active: true } }), 2)
  assert.equal(await db.count('items', { where: { name: 'nope' } }), 0)
  await db.disconnect?.()
})

test('sort orders ascending and descending', async () => {
  const db = await seeded()

  const asc = await db.find('items', { sort: [{ field: 'n', direction: 'asc' }] })
  assert.deepEqual(
    asc.map((d) => d.n),
    [1, 2, 3],
  )

  const desc = await db.find('items', { sort: [{ field: 'n', direction: 'desc' }] })
  assert.deepEqual(
    desc.map((d) => d.n),
    [3, 2, 1],
  )

  await db.disconnect?.()
})

test('limit and offset paginate a sorted result', async () => {
  const db = await seeded()
  const sort = [{ field: 'n' as const, direction: 'asc' as const }]

  const page1 = await db.find('items', { sort, limit: 2, offset: 0 })
  assert.deepEqual(
    page1.map((d) => d.n),
    [1, 2],
  )

  const page2 = await db.find('items', { sort, limit: 2, offset: 2 })
  assert.deepEqual(
    page2.map((d) => d.n),
    [3],
  )

  await db.disconnect?.()
})

test('findOne returns null for a missing id', async () => {
  const db = await seeded()
  assert.equal(await db.findOne('items', 'does-not-exist'), null)
  await db.disconnect?.()
})
