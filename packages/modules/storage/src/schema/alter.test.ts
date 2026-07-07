/**
 * Additive-migration DDL coverage: `alterTableSQL` emits one nullable ADD
 * COLUMN per missing column in the right dialect, and `undeclaredColumns`
 * surfaces live columns the entity no longer declares.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stampFields, text, number, boolean, type Entity } from '@latha/core'
import { alterTableSQL, buildTablePlan, undeclaredColumns } from './generator.js'

const entity: Entity = {
  cardinality: 'many',
  slug: 'posts',
  fields: stampFields({
    title: text({ required: true }),
    views: number({ integer: true }),
    featured: boolean(),
  }),
}

const plan = buildTablePlan(entity)

test('alterTableSQL adds only the missing columns, unconstrained', () => {
  const sql = alterTableSQL(plan, ['id', 'title', 'createdAt', 'updatedAt'])
  assert.deepEqual(sql, [
    'ALTER TABLE "posts" ADD COLUMN "views" INTEGER;',
    'ALTER TABLE "posts" ADD COLUMN "featured" INTEGER;',
  ])
  // NOT NULL is deliberately absent: SQLite cannot add such a column to a
  // populated table without a default.
  assert.ok(sql.every((s) => !s.includes('NOT NULL') && !s.includes('UNIQUE')))
})

test('alterTableSQL uses native Postgres types', () => {
  const sql = alterTableSQL(plan, ['id', 'title', 'createdAt', 'updatedAt'], 'postgres')
  assert.deepEqual(sql, [
    'ALTER TABLE "posts" ADD COLUMN "views" BIGINT;',
    'ALTER TABLE "posts" ADD COLUMN "featured" BOOLEAN;',
  ])
})

test('alterTableSQL backfills missing timestamp columns', () => {
  const sql = alterTableSQL(plan, ['id', 'title', 'views', 'featured'])
  assert.deepEqual(sql, [
    'ALTER TABLE "posts" ADD COLUMN "createdAt" TEXT;',
    'ALTER TABLE "posts" ADD COLUMN "updatedAt" TEXT;',
  ])
})

test('alterTableSQL is a no-op for an up-to-date table', () => {
  const existing = ['id', 'title', 'views', 'featured', 'createdAt', 'updatedAt']
  assert.deepEqual(alterTableSQL(plan, existing), [])
})

test('undeclaredColumns reports live columns without a field, never implicits', () => {
  const existing = ['id', 'title', 'views', 'featured', 'createdAt', 'updatedAt', 'legacy']
  assert.deepEqual(undeclaredColumns(plan, existing), ['legacy'])
})
