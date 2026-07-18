/**
 * Analytics coverage: the adapter wraps every DB round-trip in a `kon10.db.*`
 * span through the kernel's `Tracer` (the one the kernel assigns to `.tracer` at
 * boot). Proves the happy path emits a span per operation tagged with the
 * dialect + table, and that a failing query records the exception and closes the
 * span — the query-level analytics that nests under the operation-level
 * (`kon10.find`, …) spans the operations layer already emits.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  boolean,
  number,
  stampFields,
  text,
  SpanStatusCode,
  type Entity,
  type Span,
  type SpanStatus,
  type Tracer,
} from 'kon10'
import { tursoAdapter } from './turso.js'

const items: Entity = {
  cardinality: 'many',
  slug: 'items',
  fields: stampFields({ name: text(), n: number({ integer: true }), active: boolean() }),
}

const codes: Entity = {
  cardinality: 'many',
  slug: 'codes',
  fields: stampFields({ code: text({ unique: true }) }),
}

interface Captured {
  name: string
  attrs: Record<string, unknown>
  status?: SpanStatus
  exception?: unknown
  ended: boolean
}

/** A recording `Tracer` that captures every span it opens. */
function recordingTracer(): { tracer: Tracer; spans: Captured[] } {
  const spans: Captured[] = []
  const tracer: Tracer = {
    startActiveSpan<T>(name: string, fn: (span: Span) => T): T {
      const cap: Captured = { name, attrs: {}, ended: false }
      spans.push(cap)
      const span: Span = {
        setAttribute(k, v) {
          cap.attrs[k] = v
          return span
        },
        setAttributes(o) {
          Object.assign(cap.attrs, o)
          return span
        },
        recordException(e) {
          cap.exception = e
        },
        setStatus(s) {
          cap.status = s
          return span
        },
        end() {
          cap.ended = true
        },
      }
      return fn(span)
    },
  }
  return { tracer, spans }
}

test('every DB operation opens a kon10.db.* span with dialect + table attrs', async () => {
  const { tracer, spans } = recordingTracer()
  const db = tursoAdapter({ url: ':memory:' })
  db.tracer = tracer
  await db.connect?.()

  await db.migrate([items])
  const row = await db.create('items', { name: 'a', n: 1, active: true })
  await db.find('items', { where: { active: true } })
  await db.count('items')
  await db.findOne('items', row.id)
  await db.update('items', row.id, { n: 2 })
  await db.delete('items', row.id)
  await db.disconnect?.()

  const names = spans.map((s) => s.name)
  for (const op of ['migrate', 'create', 'find', 'count', 'findOne', 'update', 'delete']) {
    assert.ok(names.includes(`kon10.db.${op}`), `expected a kon10.db.${op} span`)
  }

  const create = spans.find((s) => s.name === 'kon10.db.create')!
  assert.equal(create.attrs['db.system'], 'sqlite')
  assert.equal(create.attrs['db.operation'], 'create')
  assert.equal(create.attrs['db.sql.table'], 'items')
  assert.ok(create.ended, 'span should be ended')

  // find records the row count it returned.
  const find = spans.find((s) => s.name === 'kon10.db.find')!
  assert.equal(find.attrs['db.rows'], 1)

  // All spans closed, none left open.
  assert.ok(spans.every((s) => s.ended))
})

test('a failing query records the exception and ERROR status, then rethrows', async () => {
  const { tracer, spans } = recordingTracer()
  const db = tursoAdapter({ url: ':memory:' })
  db.tracer = tracer
  await db.connect?.()
  await db.migrate([codes])

  await db.create('codes', { code: 'dup' })
  await assert.rejects(db.create('codes', { code: 'dup' })) // UNIQUE violation

  const failed = spans.filter((s) => s.name === 'kon10.db.create').at(-1)!
  assert.equal(failed.status?.code, SpanStatusCode.ERROR)
  assert.notEqual(failed.exception, undefined)
  assert.ok(failed.ended, 'span should still be ended on failure')

  await db.disconnect?.()
})

test('without a tracer the adapter still works (noop default)', async () => {
  const db = tursoAdapter({ url: ':memory:' })
  await db.connect?.()
  await db.migrate([items])
  const row = await db.create('items', { name: 'x', n: 5, active: false })
  assert.equal(row.n, 5)
  await db.disconnect?.()
})
