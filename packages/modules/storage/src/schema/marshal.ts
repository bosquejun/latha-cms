/**
 * Value marshalling between application values and SQLite storage values.
 *
 * SQLite columns hold TEXT/INTEGER/REAL/NULL only. Booleans become 0/1,
 * dates become ISO strings, and group/array/`many` fields become JSON text.
 * These helpers convert in both directions using a column's `kind`.
 */

import type { ColumnKind, TablePlan } from './generator.js'

export type SqlValue = string | number | null

export function toSql(kind: ColumnKind, value: unknown): SqlValue {
  if (value === undefined || value === null) return null

  switch (kind) {
    case 'boolean':
      return value ? 1 : 0
    case 'integer':
      return Math.trunc(Number(value))
    case 'real':
      return Number(value)
    case 'json':
      return JSON.stringify(value)
    case 'text':
      if (value instanceof Date) return value.toISOString()
      return String(value)
  }
}

export function fromSql(kind: ColumnKind, value: SqlValue): unknown {
  if (value === null) return null

  switch (kind) {
    case 'boolean':
      return value === 1 || value === '1'
    case 'integer':
    case 'real':
      return typeof value === 'number' ? value : Number(value)
    case 'json':
      try {
        return JSON.parse(String(value))
      } catch {
        return null
      }
    case 'text':
      return String(value)
  }
}

/** Deserialize a raw SQLite row into an application document using the plan. */
export function rowToDoc(
  plan: TablePlan,
  row: Record<string, SqlValue>,
): Record<string, unknown> & { id: string } {
  const doc: Record<string, unknown> = { id: String(row.id) }

  for (const col of plan.columns) {
    if (col.name in row) doc[col.name] = fromSql(col.kind, row[col.name] ?? null)
  }

  if (plan.timestamps) {
    if (row.createdAt != null) doc.createdAt = String(row.createdAt)
    if (row.updatedAt != null) doc.updatedAt = String(row.updatedAt)
  }

  return doc as Record<string, unknown> & { id: string }
}
