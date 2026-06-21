/**
 * Schema generator — Collection[] → SQLite table plans.
 *
 * LathaCMS collections are dynamic, so rather than a static Drizzle schema we
 * derive a `TablePlan` per collection describing its columns and how to
 * (de)serialize each one. The Turso adapter uses these plans to emit
 * `CREATE TABLE` statements and to marshal values to/from SQLite.
 *
 * Field → column mapping:
 *   text | richtext | media | date | select(single) | relationship(single)  → TEXT
 *   number                                                                   → REAL / INTEGER
 *   boolean                                                                  → INTEGER (0/1)
 *   group | array | *(many)                                                  → TEXT (JSON)
 */

import type { Collection, Field } from '@latha/core'

export type ColumnKind = 'text' | 'integer' | 'real' | 'boolean' | 'json'

export interface ColumnPlan {
  name: string
  kind: ColumnKind
  sqlType: 'TEXT' | 'INTEGER' | 'REAL'
  notNull: boolean
  unique: boolean
}

export interface TablePlan {
  table: string
  columns: ColumnPlan[]
  timestamps: boolean
}

function columnKindForField(field: Field): ColumnKind {
  switch (field.type) {
    case 'text':
    case 'richtext':
    case 'media':
    case 'date':
      return 'text'
    case 'number':
      return field.integer ? 'integer' : 'real'
    case 'boolean':
      return 'boolean'
    case 'select':
      return field.many ? 'json' : 'text'
    case 'relationship':
    case 'taxonomy':
      return field.many ? 'json' : 'text'
    case 'group':
    case 'array':
      return 'json'
    default:
      return 'text'
  }
}

function sqlTypeForKind(kind: ColumnKind): ColumnPlan['sqlType'] {
  switch (kind) {
    case 'integer':
    case 'boolean':
      return 'INTEGER'
    case 'real':
      return 'REAL'
    case 'text':
    case 'json':
      return 'TEXT'
  }
}

export function buildTablePlan(collection: Collection): TablePlan {
  const timestamps = collection.timestamps !== false
  const columns: ColumnPlan[] = collection.fields.map((field) => {
    const kind = columnKindForField(field)
    return {
      name: field.name,
      kind,
      sqlType: sqlTypeForKind(kind),
      notNull: Boolean(field.required),
      unique: Boolean(field.unique),
    }
  })

  return { table: collection.slug, columns, timestamps }
}

/** Produce a `CREATE TABLE IF NOT EXISTS` statement from a plan. */
export function createTableSQL(plan: TablePlan): string {
  const lines: string[] = ['"id" TEXT PRIMARY KEY NOT NULL']

  for (const col of plan.columns) {
    const parts = [`"${col.name}"`, col.sqlType]
    if (col.notNull) parts.push('NOT NULL')
    if (col.unique) parts.push('UNIQUE')
    lines.push(parts.join(' '))
  }

  if (plan.timestamps) {
    lines.push('"createdAt" TEXT NOT NULL')
    lines.push('"updatedAt" TEXT NOT NULL')
  }

  return `CREATE TABLE IF NOT EXISTS "${plan.table}" (\n  ${lines.join(',\n  ')}\n);`
}
