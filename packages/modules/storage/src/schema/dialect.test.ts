/**
 * Pure-function coverage for the Postgres dialect: DDL type mapping and value
 * marshalling. The full round-trip is exercised against a live Postgres
 * out-of-band; these tests guard the dialect-specific logic without a DB.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildTablePlan, createTableSQL } from './generator.js'
import { toPg, rowToDocPg } from './pg-marshal.js'
import type { Entity } from '@kon10/core'

const posts = {
  cardinality: 'many',
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true },
    { name: 'tags', type: 'select', options: ['a', 'b'], many: true },
    { name: 'views', type: 'number', integer: true },
    { name: 'rating', type: 'number' },
    { name: 'featured', type: 'boolean' },
    { name: 'roles', type: 'relationship', to: 'roles', many: true },
  ],
} as unknown as Entity

test('createTableSQL(postgres) maps kinds to native Postgres types', () => {
  const sql = createTableSQL(buildTablePlan(posts), 'postgres')
  assert.match(sql, /"title" TEXT NOT NULL/)
  assert.match(sql, /"slug" TEXT UNIQUE/)
  assert.match(sql, /"tags" JSONB/) // select(many) -> json -> JSONB
  assert.match(sql, /"views" BIGINT/) // integer
  assert.match(sql, /"rating" DOUBLE PRECISION/) // real
  assert.match(sql, /"featured" BOOLEAN/)
  assert.match(sql, /"roles" JSONB/) // relationship(many)
  assert.match(sql, /"createdAt" TIMESTAMPTZ NOT NULL/)
  assert.match(sql, /"id" TEXT PRIMARY KEY NOT NULL/)
})

test('createTableSQL default dialect stays SQLite (no regression)', () => {
  const sql = createTableSQL(buildTablePlan(posts))
  assert.match(sql, /"views" INTEGER/)
  assert.match(sql, /"featured" INTEGER/) // SQLite booleans are 0/1 INTEGER
  assert.match(sql, /"tags" TEXT/) // SQLite JSON is TEXT
  assert.match(sql, /"createdAt" TEXT NOT NULL/)
  assert.doesNotMatch(sql, /JSONB|TIMESTAMPTZ|BOOLEAN/)
})

test('toPg keeps native types and stringifies JSON', () => {
  assert.equal(toPg('boolean', true), true) // native boolean, not 0/1
  assert.equal(toPg('boolean', 0), false)
  assert.equal(toPg('integer', 7.9), 7) // truncated
  assert.equal(toPg('real', '1.5'), 1.5)
  assert.equal(toPg('text', 'x'), 'x')
  assert.equal(toPg('json', ['a', 'b']), '["a","b"]')
  assert.equal(toPg('text', null), null)
  assert.equal(toPg('json', undefined), null)
})

test('rowToDocPg passes native values through and normalizes timestamps', () => {
  const plan = buildTablePlan(posts)
  const created = new Date('2026-06-24T00:00:00.000Z')
  const doc = rowToDocPg(plan, {
    id: 'p1',
    title: 'Hi',
    tags: ['a', 'b'], // driver already parsed JSONB
    views: 3, // number
    featured: true, // native boolean
    roles: ['r1'],
    createdAt: created, // driver returns Date for timestamptz
    updatedAt: created,
  })
  assert.equal(doc.id, 'p1')
  assert.equal(doc.featured, true)
  assert.deepEqual(doc.tags, ['a', 'b'])
  assert.deepEqual(doc.roles, ['r1'])
  assert.equal(doc.createdAt, '2026-06-24T00:00:00.000Z') // ISO string
})

test('rowToDocPg tolerates stringified JSON and t/f booleans', () => {
  const plan = buildTablePlan(posts)
  const doc = rowToDocPg(plan, {
    id: 'p2',
    tags: '["x"]', // came back as text
    featured: 'f',
  })
  assert.deepEqual(doc.tags, ['x'])
  assert.equal(doc.featured, false)
})
