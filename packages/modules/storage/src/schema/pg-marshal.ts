/**
 * Value marshalling between application values and Postgres storage values.
 *
 * Unlike SQLite (which holds only TEXT/INTEGER/REAL/NULL — see `marshal.ts`),
 * Postgres has native `BOOLEAN`, numeric, `JSONB`, and `TIMESTAMPTZ` types, and
 * the `postgres` driver already returns native JS booleans/numbers and parses
 * `JSONB` back into JS values. So these helpers do far less work than the SQLite
 * ones: outbound, JSON is stringified (the adapter casts the placeholder to
 * `::jsonb`); inbound, `rowToDocPg` is mostly identity, only normalizing
 * timestamps to ISO strings so the document shape matches the Turso adapter.
 */

import type { ColumnKind, TablePlan } from './generator.js'

/** Values accepted by the `postgres` driver for a parameterized query. */
export type PgValue = string | number | boolean | null

/** Marshal an application value into a Postgres query parameter. */
export function toPg(kind: ColumnKind, value: unknown): PgValue {
  if (value === undefined || value === null) return null

  switch (kind) {
    case 'boolean':
      return Boolean(value)
    case 'integer':
      return Math.trunc(Number(value))
    case 'real':
      return Number(value)
    case 'json':
      // Paired with a `$n::jsonb` cast in the adapter's SQL.
      return JSON.stringify(value)
    case 'text':
      if (value instanceof Date) return value.toISOString()
      return String(value)
  }
}

/** Coerce a single value read back from Postgres into its application form. */
function fromPg(kind: ColumnKind, value: unknown): unknown {
  if (value === null || value === undefined) return null

  switch (kind) {
    case 'boolean':
      // Driver returns a native boolean, but tolerate 't'/'f' / 0/1 too.
      if (typeof value === 'boolean') return value
      return value === 1 || value === '1' || value === 't' || value === 'true'
    case 'integer':
    case 'real':
      return typeof value === 'number' ? value : Number(value)
    case 'json':
      // Driver parses JSONB into JS; only parse if it came back as a string.
      if (typeof value !== 'string') return value
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    case 'text':
      if (value instanceof Date) return value.toISOString()
      return String(value)
  }
}

/** Normalize a timestamp column (Date or string) to an ISO string. */
function toIso(value: unknown): string | undefined {
  if (value == null) return undefined
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

/** Deserialize a raw Postgres row into an application document using the plan. */
export function rowToDocPg(
  plan: TablePlan,
  row: Record<string, unknown>,
): Record<string, unknown> & { id: string } {
  const doc: Record<string, unknown> = { id: String(row.id) }

  for (const col of plan.columns) {
    if (col.name in row) doc[col.name] = fromPg(col.kind, row[col.name])
  }

  if (plan.timestamps) {
    const createdAt = toIso(row.createdAt)
    const updatedAt = toIso(row.updatedAt)
    if (createdAt !== undefined) doc.createdAt = createdAt
    if (updatedAt !== undefined) doc.updatedAt = updatedAt
  }

  return doc as Record<string, unknown> & { id: string }
}
