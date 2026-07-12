/**
 * postgresAdapter() — a Postgres / Supabase DBAdapter.
 *
 * Backed by the `postgres` (porsager) driver. Supabase is standard Postgres, so
 * the same adapter serves a self-hosted instance and Supabase; for serverless /
 * Vercel deployments use Supabase's *pooled* connection string and keep
 * `prepare: false` (pgBouncer in transaction mode can't reuse prepared
 * statements).
 *
 * Like the Turso adapter, entities are dynamic: we keep a `TablePlan` per
 * entity (built during `migrate`) and use it to render DDL, marshal values,
 * and build SQL. Identifiers are interpolated as quoted names; values are bound
 * as `$1..$n` parameters via `sql.unsafe(text, args)`.
 *
 * Schema note: `migrate()` issues `CREATE TABLE IF NOT EXISTS` and then adds
 * any newly declared columns via `ALTER TABLE ADD COLUMN` (always nullable —
 * see `alterTableSQL`). It never drops or retypes columns; removals are only
 * warned about. This matches the Turso adapter's behaviour.
 */

import postgres, { type Sql } from 'postgres'
import type { DBAdapter, Doc, Entity, Logger, Query } from '@kon10/core'
import {
  alterTableSQL,
  buildTablePlan,
  createTableSQL,
  undeclaredColumns,
  type TablePlan,
} from '../schema/generator.js'
import { rowToDocPg, toPg, type PgValue } from '../schema/pg-marshal.js'

export interface PostgresAdapterOptions {
  /** Postgres connection string, e.g. `postgres://user:pass@host:5432/db`. */
  url: string
  /** Max pool connections. Defaults to the driver default. */
  max?: number
  /**
   * Use prepared statements. Defaults to `false` so the adapter works behind
   * Supabase's transaction pooler (pgBouncer); set `true` for a direct
   * connection if you want prepared-statement caching.
   */
  prepare?: boolean
  /** SSL configuration passed through to the driver (e.g. `'require'`). */
  ssl?: Parameters<typeof postgres>[1] extends { ssl?: infer S } ? S : unknown
}

function newId(): string {
  return globalThis.crypto.randomUUID()
}

class PostgresAdapter implements DBAdapter {
  logger?: Logger

  private readonly sql: Sql
  private readonly plans = new Map<string, TablePlan>()

  constructor(options: PostgresAdapterOptions) {
    this.sql = postgres(options.url, {
      max: options.max,
      prepare: options.prepare ?? false,
      ssl: options.ssl as never,
    })
  }

  async connect(): Promise<void> {
    // Surface connection errors early with a trivial round-trip.
    await this.sql.unsafe('SELECT 1')
  }

  async disconnect(): Promise<void> {
    await this.sql.end()
  }

  async migrate(entities: Entity[]): Promise<void> {
    for (const entity of entities) {
      const plan = buildTablePlan(entity)
      this.plans.set(plan.table, plan)
      await this.sql.unsafe(createTableSQL(plan, 'postgres'))
      await this.reconcileColumns(plan)
    }
  }

  /**
   * Additive schema evolution: add any declared column missing from the live
   * table (always nullable — see `alterTableSQL`), and warn about live columns
   * the entity no longer declares. Never drops or retypes.
   */
  private async reconcileColumns(plan: TablePlan): Promise<void> {
    const rows = await this.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = current_schema()`,
      [plan.table],
    )
    const existing = rows.map((row) => String(row.column_name))
    for (const sql of alterTableSQL(plan, existing, 'postgres')) {
      await this.sql.unsafe(sql)
    }
    for (const name of undeclaredColumns(plan, existing)) {
      const msg = `table "${plan.table}" has a column "${name}" that no field declares; it is left untouched.`
      if (this.logger) this.logger.warn({ table: plan.table, column: name }, msg)
      else console.warn(`[kon10] ${msg}`)
    }
  }

  private plan(slug: string): TablePlan {
    const plan = this.plans.get(slug)
    if (!plan) {
      throw new Error(
        `No table plan for "${slug}". Was migrate() run for this entity?`,
      )
    }
    return plan
  }

  private async query(
    sql: string,
    args: PgValue[] = [],
  ): Promise<Record<string, unknown>[]> {
    const rows = await this.sql.unsafe(sql, args as never[])
    return rows as unknown as Record<string, unknown>[]
  }

  async find(slug: string, query: Query = {}): Promise<Doc[]> {
    const plan = this.plan(slug)
    const { sql, args } = buildSelect(plan, query)
    const rows = await this.query(sql, args)
    return rows.map((row) => rowToDocPg(plan, row) as Doc)
  }

  async findOne(slug: string, id: string): Promise<Doc | null> {
    const plan = this.plan(slug)
    const rows = await this.query(
      `SELECT * FROM "${plan.table}" WHERE "id" = $1 LIMIT 1`,
      [id],
    )
    const row = rows[0]
    if (!row) return null
    return rowToDocPg(plan, row) as Doc
  }

  async count(slug: string, query: Query = {}): Promise<number> {
    const plan = this.plan(slug)
    const { whereSql, args } = buildWhere(plan, query.where)
    const rows = await this.query(
      `SELECT COUNT(*)::int AS count FROM "${plan.table}"${whereSql}`,
      args,
    )
    return Number((rows[0]?.count as number | undefined) ?? 0)
  }

  async create(
    slug: string,
    data: Record<string, unknown>,
  ): Promise<Doc> {
    const plan = this.plan(slug)
    const now = new Date().toISOString()
    const id = typeof data.id === 'string' ? data.id : newId()

    const cols: string[] = ['"id"']
    const placeholders: string[] = ['$1']
    const args: PgValue[] = [id]

    for (const col of plan.columns) {
      if (!(col.name in data)) continue
      cols.push(`"${col.name}"`)
      placeholders.push(placeholderFor(col.kind, args.length + 1))
      args.push(toPg(col.kind, data[col.name]))
    }

    if (plan.timestamps) {
      cols.push('"createdAt"', '"updatedAt"')
      placeholders.push(`$${args.length + 1}`, `$${args.length + 2}`)
      args.push(now, now)
    }

    const rows = await this.query(
      `INSERT INTO "${plan.table}" (${cols.join(', ')}) VALUES (${placeholders.join(
        ', ',
      )}) RETURNING *`,
      args,
    )
    const created = rows[0]
    if (!created) throw new Error(`Failed to read back created "${slug}".`)
    return rowToDocPg(plan, created) as Doc
  }

  async update(
    slug: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Doc> {
    const plan = this.plan(slug)

    const sets: string[] = []
    const args: PgValue[] = []

    for (const col of plan.columns) {
      if (!(col.name in data)) continue
      sets.push(`"${col.name}" = ${placeholderFor(col.kind, args.length + 1)}`)
      args.push(toPg(col.kind, data[col.name]))
    }

    if (plan.timestamps) {
      sets.push(`"updatedAt" = $${args.length + 1}`)
      args.push(new Date().toISOString())
    }

    if (sets.length === 0) {
      const existing = await this.findOne(slug, id)
      if (!existing) throw new Error(`Record "${slug}/${id}" not found.`)
      return existing
    }

    args.push(id)
    const rows = await this.query(
      `UPDATE "${plan.table}" SET ${sets.join(', ')} WHERE "id" = $${args.length} RETURNING *`,
      args,
    )
    const updated = rows[0]
    if (!updated) throw new Error(`Record "${slug}/${id}" not found.`)
    return rowToDocPg(plan, updated) as Doc
  }

  async delete(slug: string, id: string): Promise<void> {
    const plan = this.plan(slug)
    await this.query(`DELETE FROM "${plan.table}" WHERE "id" = $1`, [id])
  }
}

/** Render the `$n` placeholder for a column, casting JSON to `::jsonb`. */
function placeholderFor(kind: TablePlan['columns'][number]['kind'], n: number): string {
  return kind === 'json' ? `$${n}::jsonb` : `$${n}`
}

/** Build a WHERE clause from a plain equality map, with `$n` placeholders. */
function buildWhere(
  plan: TablePlan,
  where: Record<string, unknown> | undefined,
): { whereSql: string; args: PgValue[] } {
  if (!where || Object.keys(where).length === 0) {
    return { whereSql: '', args: [] }
  }

  const clauses: string[] = []
  const args: PgValue[] = []
  const byName = new Map(plan.columns.map((c) => [c.name, c]))

  for (const [key, value] of Object.entries(where)) {
    if (key === 'id') {
      args.push(String(value))
      clauses.push(`"id" = $${args.length}`)
      continue
    }
    const col = byName.get(key)
    if (!col) continue
    args.push(toPg(col.kind, value))
    clauses.push(`"${key}" = $${args.length}`)
  }

  if (clauses.length === 0) return { whereSql: '', args: [] }
  return { whereSql: ` WHERE ${clauses.join(' AND ')}`, args }
}

function buildSelect(
  plan: TablePlan,
  query: Query,
): { sql: string; args: PgValue[] } {
  const { whereSql, args } = buildWhere(plan, query.where)

  let sql = `SELECT * FROM "${plan.table}"${whereSql}`

  if (query.sort && query.sort.length > 0) {
    const validFields = new Set(['id', ...plan.columns.map((c) => c.name)])
    if (plan.timestamps) { validFields.add('createdAt'); validFields.add('updatedAt') }
    const safeSorts = query.sort.filter((s) => validFields.has(s.field))
    if (safeSorts.length > 0) {
      const order = safeSorts
        .map((s) => `"${s.field}" ${s.direction === 'desc' ? 'DESC' : 'ASC'}`)
        .join(', ')
      sql += ` ORDER BY ${order}`
    } else if (plan.timestamps) {
      sql += ` ORDER BY "createdAt" DESC`
    }
  } else if (plan.timestamps) {
    sql += ` ORDER BY "createdAt" DESC`
  }

  if (query.limit !== undefined) {
    args.push(query.limit)
    sql += ` LIMIT $${args.length}`
    if (query.offset !== undefined) {
      args.push(query.offset)
      sql += ` OFFSET $${args.length}`
    }
  }

  return { sql, args }
}

/** Create a Postgres / Supabase-backed DBAdapter. */
export function postgresAdapter(options: PostgresAdapterOptions): DBAdapter {
  return new PostgresAdapter(options)
}
