/**
 * KyselyAdapter — the shared DBAdapter implementation both concrete adapters
 * ({@link ../adapters/turso.js | tursoAdapter}, {@link ../adapters/postgres.js |
 * postgresAdapter}) delegate to.
 *
 * Kon10 entities are dynamic, so there is no static Kysely schema: the adapter
 * runs in Kysely's dynamic mode (`Kysely<any>` + `db.dynamic.ref`), building
 * every query from the runtime `TablePlan`. One query implementation now serves
 * both dialects — Kysely renders the dialect-correct SQL (`?` vs `$n`, quoting,
 * `RETURNING`) from a single call site, so the previous per-adapter
 * `buildSelect`/`buildWhere`/INSERT/UPDATE duplication is gone.
 *
 * What is *not* Kysely's job stays where it was:
 *   - DDL + additive reconciliation is still `schema/generator.ts` — Kysely only
 *     executes the strings it produces (`sql.raw`). The migration contract
 *     (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`, never drop/retype;
 *     warn on drift) is unchanged.
 *   - Value marshaling stays dialect-specific (`schema/marshal.ts` for SQLite,
 *     `schema/pg-marshal.ts` for Postgres) — the storage shapes differ at the
 *     driver level, which no query builder abstracts away.
 *
 * Analytics: every DB round-trip is wrapped in a `kon10.db.*` span via the
 * kernel's `Tracer` (assigned on `.tracer` at boot). These are a finer child of
 * the operation-level `kon10.find` / `kon10.create` / … spans the operations
 * layer emits — isolating the actual query time from access checks, hooks, and
 * validation. With the default `noopTracer` they cost nothing.
 */

import { sql, type Kysely } from 'kysely'
import {
  noopTracer,
  withSpan,
  type DBAdapter,
  type Doc,
  type Entity,
  type Logger,
  type Query,
  type Span,
  type Tracer,
} from 'kon10'
import {
  alterTableSQL,
  buildTablePlan,
  createTableSQL,
  undeclaredColumns,
  type Dialect,
  type TablePlan,
} from '../schema/generator.js'
import { rowToDoc as rowToDocSqlite, toSql } from '../schema/marshal.js'
import { rowToDocPg, toPg } from '../schema/pg-marshal.js'

function newId(): string {
  return globalThis.crypto.randomUUID()
}

/** OpenTelemetry `db.system` value for a dialect. */
function dbSystem(dialect: Dialect): string {
  return dialect === 'postgres' ? 'postgresql' : 'sqlite'
}

export class KyselyAdapter implements DBAdapter {
  logger?: Logger
  tracer?: Tracer

  private readonly plans = new Map<string, TablePlan>()

  constructor(
    /** A dynamic-mode Kysely instance; `any` because entities have no static schema. */
    private readonly db: Kysely<any>,
    private readonly dialect: Dialect,
  ) {}

  async connect(): Promise<void> {
    // Surface connection errors early with a trivial round-trip.
    await sql`select 1`.execute(this.db)
  }

  async disconnect(): Promise<void> {
    await this.db.destroy()
  }

  async migrate(entities: Entity[]): Promise<void> {
    await this.span('migrate', '*', async () => {
      for (const entity of entities) {
        const plan = buildTablePlan(entity)
        this.plans.set(plan.table, plan)
        await sql.raw(createTableSQL(plan, this.dialect)).execute(this.db)
        await this.reconcileColumns(plan)
      }
    })
  }

  /**
   * Additive schema evolution: add any declared column missing from the live
   * table (always nullable — see `alterTableSQL`), and warn about live columns
   * the entity no longer declares. Never drops or retypes. Live columns come
   * from Kysely's introspection, which unifies what used to be a SQLite
   * `PRAGMA table_info` and a Postgres `information_schema` query.
   */
  private async reconcileColumns(plan: TablePlan): Promise<void> {
    const tables = await this.db.introspection.getTables()
    const table = tables.find((t) => t.name === plan.table)
    const existing = table ? table.columns.map((c) => c.name) : []

    for (const ddl of alterTableSQL(plan, existing, this.dialect)) {
      await sql.raw(ddl).execute(this.db)
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

  /** Run `fn` inside a `kon10.db.<op>` span tagged with dialect + table. */
  private span<T>(op: string, table: string, fn: (span: Span) => Promise<T>): Promise<T> {
    return withSpan(this.tracer ?? noopTracer, `kon10.db.${op}`, async (span) => {
      span.setAttributes({
        'db.system': dbSystem(this.dialect),
        'db.operation': op,
        'db.sql.table': table,
      })
      return fn(span)
    })
  }

  /** Deserialize a raw driver row into an application document. */
  private rowToDoc(plan: TablePlan, row: Record<string, unknown>): Doc {
    return (
      this.dialect === 'postgres'
        ? rowToDocPg(plan, row)
        : rowToDocSqlite(plan, row as Record<string, string | number | null>)
    ) as Doc
  }

  /**
   * Marshal an application value into a bound query parameter. On Postgres a
   * JSON value is stringified and cast to `::jsonb` (the driver would otherwise
   * turn a JS array into a Postgres array); on SQLite JSON is plain TEXT.
   */
  private bind(kind: TablePlan['columns'][number]['kind'], value: unknown): unknown {
    if (this.dialect === 'postgres') {
      const v = toPg(kind, value)
      return kind === 'json' && v !== null ? sql`${v}::jsonb` : v
    }
    return toSql(kind, value)
  }

  /** Apply a plain equality `where` map to a query builder. */
  private applyWhere<QB extends { where: (...a: any[]) => QB }>(
    qb: QB,
    plan: TablePlan,
    where: Record<string, unknown> | undefined,
  ): QB {
    if (!where) return qb
    const byName = new Map(plan.columns.map((c) => [c.name, c]))
    const ref = this.db.dynamic.ref.bind(this.db.dynamic)
    for (const [key, value] of Object.entries(where)) {
      if (key === 'id') {
        qb = qb.where(ref('id'), '=', String(value))
        continue
      }
      const col = byName.get(key)
      if (!col) continue
      qb = qb.where(ref(key), '=', this.bind(col.kind, value))
    }
    return qb
  }

  async find(slug: string, query: Query = {}): Promise<Doc[]> {
    const plan = this.plan(slug)
    return this.span('find', slug, async (span) => {
      let qb = this.db.selectFrom(plan.table).selectAll()
      qb = this.applyWhere(qb, plan, query.where)

      const ref = this.db.dynamic.ref.bind(this.db.dynamic)
      const valid = new Set<string>(['id', ...plan.columns.map((c) => c.name)])
      if (plan.timestamps) {
        valid.add('createdAt')
        valid.add('updatedAt')
      }
      const safeSorts = (query.sort ?? []).filter((s) => valid.has(s.field))
      if (safeSorts.length > 0) {
        for (const s of safeSorts) qb = qb.orderBy(ref(s.field), s.direction)
      } else if (plan.timestamps) {
        qb = qb.orderBy(ref('createdAt'), 'desc')
      }

      if (query.limit !== undefined) {
        qb = qb.limit(query.limit)
        if (query.offset !== undefined) qb = qb.offset(query.offset)
      }

      const rows = (await qb.execute()) as Record<string, unknown>[]
      span.setAttribute('db.rows', rows.length)
      return rows.map((r) => this.rowToDoc(plan, r))
    })
  }

  async findOne(slug: string, id: string): Promise<Doc | null> {
    const plan = this.plan(slug)
    return this.span('findOne', slug, async () => {
      const ref = this.db.dynamic.ref.bind(this.db.dynamic)
      const row = (await this.db
        .selectFrom(plan.table)
        .selectAll()
        .where(ref('id'), '=', id)
        .limit(1)
        .executeTakeFirst()) as Record<string, unknown> | undefined
      return row ? this.rowToDoc(plan, row) : null
    })
  }

  async count(slug: string, query: Query = {}): Promise<number> {
    const plan = this.plan(slug)
    return this.span('count', slug, async () => {
      let qb = this.db.selectFrom(plan.table).select(this.db.fn.countAll().as('count'))
      qb = this.applyWhere(qb, plan, query.where)
      const row = (await qb.executeTakeFirst()) as { count?: unknown } | undefined
      return Number(row?.count ?? 0)
    })
  }

  async create(slug: string, data: Record<string, unknown>): Promise<Doc> {
    const plan = this.plan(slug)
    return this.span('create', slug, async () => {
      const now = new Date().toISOString()
      const id = typeof data.id === 'string' ? data.id : newId()

      const values: Record<string, unknown> = { id }
      for (const col of plan.columns) {
        if (!(col.name in data)) continue
        values[col.name] = this.bind(col.kind, data[col.name])
      }
      if (plan.timestamps) {
        values.createdAt = now
        values.updatedAt = now
      }

      const row = (await this.db
        .insertInto(plan.table)
        .values(values)
        .returningAll()
        .executeTakeFirst()) as Record<string, unknown> | undefined
      if (!row) throw new Error(`Failed to read back created "${slug}".`)
      return this.rowToDoc(plan, row)
    })
  }

  async update(slug: string, id: string, data: Record<string, unknown>): Promise<Doc> {
    const plan = this.plan(slug)
    return this.span('update', slug, async () => {
      const set: Record<string, unknown> = {}
      for (const col of plan.columns) {
        if (!(col.name in data)) continue
        set[col.name] = this.bind(col.kind, data[col.name])
      }
      if (plan.timestamps) set.updatedAt = new Date().toISOString()

      // Nothing to write (no matching fields, timestamps disabled): the row is
      // unchanged — return it as-is, or fail if the id doesn't exist.
      if (Object.keys(set).length === 0) {
        const existing = await this.findOne(slug, id)
        if (!existing) throw new Error(`Record "${slug}/${id}" not found.`)
        return existing
      }

      const ref = this.db.dynamic.ref.bind(this.db.dynamic)
      const row = (await this.db
        .updateTable(plan.table)
        .set(set)
        .where(ref('id'), '=', id)
        .returningAll()
        .executeTakeFirst()) as Record<string, unknown> | undefined
      if (!row) throw new Error(`Record "${slug}/${id}" not found.`)
      return this.rowToDoc(plan, row)
    })
  }

  async delete(slug: string, id: string): Promise<void> {
    const plan = this.plan(slug)
    await this.span('delete', slug, async () => {
      const ref = this.db.dynamic.ref.bind(this.db.dynamic)
      await this.db.deleteFrom(plan.table).where(ref('id'), '=', id).execute()
    })
  }
}
