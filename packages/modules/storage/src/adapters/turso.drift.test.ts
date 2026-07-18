/**
 * Live drift handling against in-memory libsql: when a column exists in the
 * table but no field declares it anymore, `migrate` warns and leaves it
 * untouched — it never drops or retypes (the "warn, don't apply" contract in
 * `docs/concepts/migrations.md`). Complements `schema/alter.test.ts`, which
 * asserts `undeclaredColumns` at the SQL-generation level, by proving the live
 * adapter warns and preserves the data.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stampFields, text, type Entity, type Logger } from '@kon10/core'
import { tursoAdapter } from './turso.js'

const withLegacy: Entity = {
  cardinality: 'many',
  slug: 'posts',
  fields: stampFields({ title: text({ required: true }), legacy: text() }),
}

const withoutLegacy: Entity = {
  cardinality: 'many',
  slug: 'posts',
  fields: stampFields({ title: text({ required: true }) }),
}

test('an undeclared live column is warned about, not dropped', async () => {
  const warnings: Array<{ obj: unknown; msg: string }> = []
  const logger = {
    warn: (obj: unknown, msg: string) => warnings.push({ obj, msg }),
    info: () => {},
    error: () => {},
    debug: () => {},
    child: () => logger,
  } as unknown as Logger

  const db = tursoAdapter({ url: ':memory:' })
  db.logger = logger
  await db.connect?.()

  // v1 declares `legacy`; write a row that fills it.
  await db.migrate([withLegacy])
  const row = await db.create('posts', { title: 'Keep', legacy: 'preserve-me' })

  // v2 drops the `legacy` field — migrate must warn, not alter the column.
  await db.migrate([withoutLegacy])
  assert.equal(warnings.length, 1)
  assert.deepEqual(warnings[0]!.obj, { table: 'posts', column: 'legacy' })
  assert.match(warnings[0]!.msg, /legacy/)

  // The pre-existing row is still readable and the table still works.
  const stillThere = await db.findOne('posts', row.id)
  assert.equal(stillThere!.title, 'Keep')

  // Re-declaring `legacy` proves the data was never dropped — it reads back.
  await db.migrate([withLegacy])
  const recovered = await db.findOne('posts', row.id)
  assert.equal(recovered!.legacy, 'preserve-me')

  await db.disconnect?.()
})
