/**
 * Schema generator — Entity[] → SQLite table plans.
 *
 * LathaCMS entities are dynamic, so rather than a static Drizzle schema we
 * derive a `TablePlan` per entity describing its columns and how to
 * (de)serialize each one. The Turso adapter uses these plans to emit
 * `CREATE TABLE` statements and to marshal values to/from SQLite.
 *
 * Field → column mapping:
 *   text | richtext | date | select(single) | relationship(single)         → TEXT
 *   number                                                                   → REAL / INTEGER
 *   boolean                                                                  → INTEGER (0/1)
 *   group | array | *(many)                                                  → TEXT (JSON)
 */

import { buildZodSchema } from '@latha/core'
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

/** Structural view of a Zod schema node — just enough to classify storage shape. */
interface ZodNode {
  _def?: {
    typeName?: string
    innerType?: ZodNode
    schema?: ZodNode
  }
}

/**
 * Classify a field's registered data schema (built by the field registry from
 * the type's `buildDataSchema`) into a column kind. Wrapper types
 * (optional / nullable / default / effects) are unwrapped first. Returns `null`
 * when the schema doesn't pin down a storage shape — e.g. `z.unknown()`, which
 * the registry substitutes for types not registered in this runtime.
 */
function columnKindFromDataSchema(node: ZodNode | undefined): ColumnKind | null {
  let def = node?._def
  while (
    def &&
    (def.typeName === 'ZodOptional' ||
      def.typeName === 'ZodNullable' ||
      def.typeName === 'ZodDefault' ||
      def.typeName === 'ZodEffects')
  ) {
    def = (def.innerType ?? def.schema)?._def
  }
  switch (def?.typeName) {
    case 'ZodArray':
    case 'ZodObject':
    case 'ZodRecord':
    case 'ZodTuple':
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return 'json'
    case 'ZodNumber':
      return 'real'
    case 'ZodBoolean':
      return 'boolean'
    case 'ZodString':
    case 'ZodEnum':
    case 'ZodLiteral':
    case 'ZodDate':
      return 'text'
    default:
      return null
  }
}

function columnKindForField(field: Field): ColumnKind {
  switch (field.type) {
    case 'text':
    case 'richtext':
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
      // Module-registered types: derive the column shape from the data schema
      // the type registered — the same Zod source of truth validation uses
      // (modules register in `onInit`, which runs before `migrate`).
      const ext = field as unknown as Record<string, unknown> & { name: string }
      const shape = buildZodSchema([ext]).shape
      const derived = columnKindFromDataSchema(shape[ext.name] as ZodNode)
      if (derived) return derived
      // Type not registered in this runtime — fall back to the `many` convention.
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
 * Build a table plan from any entity. Every entity — singleton or list,
 * hierarchical or not — is stored as a table; the generator only needs its
 * field set and timestamp setting, both already fully resolved by the
 * entity's factory.
 */
export function buildTablePlan(entity: Entity): TablePlan {
  const timestamps = entity.timestamps !== false

  const columns: ColumnPlan[] = entity.fields.map((field) => {
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
