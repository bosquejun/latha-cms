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

import type { Entity, Field } from '@latha/core'

export type ColumnKind = 'text' | 'integer' | 'real' | 'boolean' | 'json'

/** SQL dialect a table plan is rendered for. */
export type Dialect = 'sqlite' | 'postgres'

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
    case 'relationship':
      return field.many ? 'json' : 'text'
    case 'group':
    case 'array':
      return 'json'
    default: {
      // Module-registered types (e.g. taxonomy) are handled generically:
      // multi-value fields are stored as JSON, single-value as TEXT.
      const ext = field as unknown as Record<string, unknown>
      return ext.many ? 'json' : 'text'
    }
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

/**
 * Build a table plan from any entity. Collections, document singletons, and
 * taxonomies are all stored as tables; the only difference is the field set
 * (taxonomies carry their implicit `name`/`slug`/`parent` fields, populated by
 * the `Taxonomy()` factory) and the default timestamp behavior.
 */
export function buildTablePlan(entity: Entity): TablePlan {
  const fields: Field[] = entity.kind === 'taxonomy' ? entity.fields ?? [] : entity.fields
  const timestamps = entity.kind === 'taxonomy' ? true : entity.timestamps !== false

  const columns: ColumnPlan[] = fields.map((field) => {
    const kind = columnKindForField(field)
    return {
      name: field.name,
      kind,
      sqlType: sqlTypeForKind(kind),
      notNull: Boolean(field.required),
      unique: Boolean(field.unique),
    }
  })

  return { table: entity.slug, columns, timestamps }
}

/**
 * Postgres SQL type for a column kind. SQLite stores everything as
 * TEXT/INTEGER/REAL (see {@link sqlTypeForKind}); Postgres has richer native
 * types, so booleans, JSON, and numbers map to their proper column types.
 */
function pgTypeForKind(kind: ColumnKind): string {
  switch (kind) {
    case 'text':
      return 'TEXT'
    case 'integer':
      return 'BIGINT'
    case 'real':
      return 'DOUBLE PRECISION'
    case 'boolean':
      return 'BOOLEAN'
    case 'json':
      return 'JSONB'
  }
}

/** Render the DDL column type for a kind in the given dialect. */
function ddlTypeForColumn(col: ColumnPlan, dialect: Dialect): string {
  return dialect === 'postgres' ? pgTypeForKind(col.kind) : col.sqlType
}

/** Render the DDL type used for the implicit `createdAt`/`updatedAt` columns. */
function timestampType(dialect: Dialect): string {
  return dialect === 'postgres' ? 'TIMESTAMPTZ' : 'TEXT'
}

/**
 * Produce a `CREATE TABLE IF NOT EXISTS` statement from a plan. Defaults to the
 * SQLite dialect (the original behaviour); pass `'postgres'` for Postgres DDL.
 */
export function createTableSQL(plan: TablePlan, dialect: Dialect = 'sqlite'): string {
  const lines: string[] = ['"id" TEXT PRIMARY KEY NOT NULL']

  for (const col of plan.columns) {
    const parts = [`"${col.name}"`, ddlTypeForColumn(col, dialect)]
    if (col.notNull) parts.push('NOT NULL')
    if (col.unique) parts.push('UNIQUE')
    lines.push(parts.join(' '))
  }

  if (plan.timestamps) {
    const ts = timestampType(dialect)
    lines.push(`"createdAt" ${ts} NOT NULL`)
    lines.push(`"updatedAt" ${ts} NOT NULL`)
  }

  return `CREATE TABLE IF NOT EXISTS "${plan.table}" (\n  ${lines.join(',\n  ')}\n);`
}
