/**
 * Schema generator — Entity[] → SQLite table plans.
 *
 * Kon10 entities are dynamic, so rather than a static Drizzle schema we
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

import { buildZodSchema } from 'kon10'
import type { Entity, Field } from 'kon10'

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
    /** Zod v3 tag (e.g. `'ZodObject'`). Absent in v4. */
    typeName?: string
    /** Zod v4 tag (e.g. `'object'`). Absent in v3. */
    type?: string
    innerType?: ZodNode
    schema?: ZodNode
  }
}

/** A node's structural tag, normalized across Zod v3 (`typeName`) and v4 (`type`). */
function nodeTag(def: ZodNode['_def'] | undefined): string | undefined {
  return def?.typeName ?? def?.type
}

/** Wrapper tags whose inner schema determines the storage shape. */
const WRAPPER_TAGS = new Set([
  'ZodOptional',
  'ZodNullable',
  'ZodDefault',
  'ZodEffects', // v3
  'optional',
  'nullable',
  'default', // v4
])

/**
 * Classify a field's registered data schema (built by the field registry from
 * the type's `buildDataSchema`) into a column kind. Wrapper types
 * (optional / nullable / default / effects) are unwrapped first. Returns `null`
 * when the schema doesn't pin down a storage shape — e.g. `z.unknown()`, which
 * the registry substitutes for types not registered in this runtime.
 *
 * Recognizes both Zod v3 (`_def.typeName`, e.g. `'ZodObject'`) and Zod v4
 * (`_def.type`, e.g. `'object'`) tags — v4 renamed the internal discriminant,
 * so keying only on `typeName` would misclassify every object/array field as
 * text and never JSON-encode it on write.
 */
function columnKindFromDataSchema(node: ZodNode | undefined): ColumnKind | null {
  let def = node?._def
  while (def && WRAPPER_TAGS.has(nodeTag(def) ?? '')) {
    def = (def.innerType ?? def.schema)?._def
  }
  switch (nodeTag(def)) {
    case 'ZodArray':
    case 'array':
    case 'ZodObject':
    case 'object':
    case 'ZodRecord':
    case 'record':
    case 'ZodTuple':
    case 'tuple':
    case 'ZodUnion':
    case 'union':
    case 'ZodDiscriminatedUnion':
      return 'json'
    case 'ZodNumber':
    case 'number':
      return 'real'
    case 'ZodBoolean':
    case 'boolean':
      return 'boolean'
    case 'ZodString':
    case 'string':
    case 'ZodEnum':
    case 'enum':
    case 'ZodLiteral':
    case 'literal':
    case 'ZodDate':
    case 'date':
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

function ddlTypeForColumn(col: ColumnPlan, dialect: Dialect): string {
  return dialect === 'postgres' ? pgTypeForKind(col.kind) : col.sqlType
}

/** Render the DDL type used for the implicit `createdAt`/`updatedAt` columns. */
function timestampType(dialect: Dialect): string {
  return dialect === 'postgres' ? 'TIMESTAMPTZ' : 'TEXT'
}

/**
 * Produce a `CREATE TABLE IF NOT EXISTS` statement from a plan. Defaults to
 * SQLite; pass `'postgres'` for Postgres DDL.
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

/**
 * `ALTER TABLE … ADD COLUMN` statements bringing an existing table up to
 * `plan`: one per declared (or implicit timestamp) column missing from
 * `existingColumns`.
 *
 * Added columns are always nullable and unconstrained — SQLite can neither add
 * a NOT NULL column without a default to a non-empty table nor add a UNIQUE
 * column at all — so NOT NULL/UNIQUE on late-added fields is enforced at the
 * validation layer only, until a manual migration hardens the table.
 */
export function alterTableSQL(
  plan: TablePlan,
  existingColumns: Iterable<string>,
  dialect: Dialect = 'sqlite',
): string[] {
  const existing = new Set(existingColumns)
  const out: string[] = []
  for (const col of plan.columns) {
    if (existing.has(col.name)) continue
    out.push(
      `ALTER TABLE "${plan.table}" ADD COLUMN "${col.name}" ${ddlTypeForColumn(col, dialect)};`,
    )
  }
  if (plan.timestamps) {
    for (const name of ['createdAt', 'updatedAt']) {
      if (existing.has(name)) continue
      out.push(
        `ALTER TABLE "${plan.table}" ADD COLUMN "${name}" ${timestampType(dialect)};`,
      )
    }
  }
  return out
}

/**
 * Live columns no longer declared by the entity. Never dropped — data loss is
 * a human decision — but surfaced so adapters can warn at boot.
 */
export function undeclaredColumns(
  plan: TablePlan,
  existingColumns: Iterable<string>,
): string[] {
  const declared = new Set(['id', ...plan.columns.map((c) => c.name)])
  if (plan.timestamps) {
    declared.add('createdAt')
    declared.add('updatedAt')
  }
  return [...existingColumns].filter((name) => !declared.has(name))
}
