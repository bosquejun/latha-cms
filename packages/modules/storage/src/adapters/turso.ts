/**
 * tursoAdapter() — the default DBAdapter.
 *
 * Backed by `@libsql/client`, which speaks to Turso over HTTP and also
 * supports local `file:` URLs — so the same adapter runs in production
 * (Turso) and in local dev / tests (a SQLite file or `:memory:`).
 *
 * Collections are dynamic, so we keep a `TablePlan` per collection (built
 * during `migrate`) and use it to marshal values and build SQL.
 */

import { createClient, type Client } from '@libsql/client'
import type { DBAdapter, Doc, Entity, Query } from '@latha/core'
import {
  buildTablePlan,
  createTableSQL,
  type TablePlan,
} from '../schema/generator.js'
import { rowToDoc, toSql, type SqlValue } from '../schema/marshal.js'

export interface TursoAdapterOptions {
  /** libsql URL — e.g. `libsql://db.turso.io`, `file:local.db`, or `:memory:`. */
  url: string
  /** Turso auth token. Omit for local file / in-memory databases. */
  authToken?: string
}

function newId(): string {
  return globalThis.crypto.randomUUID()
}

class TursoAdapter implements DBAdapter {
  private readonly client: Client
  private readonly plans = new Map<string, TablePlan>()

  constructor(options: TursoAdapterOptions) {
    this.client = createClient({
      url: options.url,
      authToken: options.authToken,
    })
  }

  async connect(): Promise<void> {
    // libsql connects lazily; issue a trivial round-trip to surface errors early.
    await this.client.execute('SELECT 1')
  }

  async disconnect(): Promise<void> {
    this.client.close()
  }

  async migrate(entities: Entity[]): Promise<void> {
    for (const entity of entities) {
      const plan = buildTablePlan(entity)
      this.plans.set(plan.table, plan)
      await this.client.execute(createTableSQL(plan))
    }
  }

  private plan(collection: string): TablePlan {
    const plan = this.plans.get(collection)
    if (!plan) {
      throw new Error(
        `No table plan for "${collection}". Was migrate() run for this collection?`,
      )
    }
    return plan
  }

  async find(collection: string, query: Query = {}): Promise<Doc[]> {
    const plan = this.plan(collection)
    const { sql, args } = buildSelect(plan, query)
    const result = await this.client.execute({ sql, args })
    return result.rows.map(
      (row) => rowToDoc(plan, row as unknown as Record<string, SqlValue>) as Doc,
    )
  }

  async findOne(collection: string, id: string): Promise<Doc | null> {
    const plan = this.plan(collection)
    const result = await this.client.execute({
      sql: `SELECT * FROM "${plan.table}" WHERE "id" = ? LIMIT 1`,
      args: [id],
    })
    const row = result.rows[0]
    if (!row) return null
    return rowToDoc(plan, row as unknown as Record<string, SqlValue>) as Doc
  }

  async count(collection: string, query: Query = {}): Promise<number> {
    const plan = this.plan(collection)
    const { whereSql, args } = buildWhere(plan, query.where)
    const result = await this.client.execute({
      sql: `SELECT COUNT(*) as count FROM "${plan.table}"${whereSql}`,
      args,
    })
    return Number((result.rows[0] as Record<string, unknown>)?.count ?? 0)
  }

  async create(
    collection: string,
    data: Record<string, unknown>,
  ): Promise<Doc> {
    const plan = this.plan(collection)
    const now = new Date().toISOString()
    const id = typeof data.id === 'string' ? data.id : newId()

    const cols: string[] = ['"id"']
    const placeholders: string[] = ['?']
    const args: SqlValue[] = [id]

    for (const col of plan.columns) {
      if (!(col.name in data)) continue
      cols.push(`"${col.name}"`)
      placeholders.push('?')
      args.push(toSql(col.kind, data[col.name]))
    }

    if (plan.timestamps) {
      cols.push('"createdAt"', '"updatedAt"')
      placeholders.push('?', '?')
      args.push(now, now)
    }

    await this.client.execute({
      sql: `INSERT INTO "${plan.table}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
      args,
    })

    const created = await this.findOne(collection, id)
    if (!created) throw new Error(`Failed to read back created "${collection}".`)
    return created
  }

  async update(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Doc> {
    const plan = this.plan(collection)

    const sets: string[] = []
    const args: SqlValue[] = []

    for (const col of plan.columns) {
      if (!(col.name in data)) continue
      sets.push(`"${col.name}" = ?`)
      args.push(toSql(col.kind, data[col.name]))
    }

    if (plan.timestamps) {
      sets.push('"updatedAt" = ?')
      args.push(new Date().toISOString())
    }

    if (sets.length > 0) {
      args.push(id)
      await this.client.execute({
        sql: `UPDATE "${plan.table}" SET ${sets.join(', ')} WHERE "id" = ?`,
        args,
      })
    }

    const updated = await this.findOne(collection, id)
    if (!updated) throw new Error(`Document "${collection}/${id}" not found.`)
    return updated
  }

  async delete(collection: string, id: string): Promise<void> {
    const plan = this.plan(collection)
    await this.client.execute({
      sql: `DELETE FROM "${plan.table}" WHERE "id" = ?`,
      args: [id],
    })
  }
}

/** Build a WHERE clause from a plain equality map. */
function buildWhere(
  plan: TablePlan,
  where: Record<string, unknown> | undefined,
): { whereSql: string; args: SqlValue[] } {
  if (!where || Object.keys(where).length === 0) {
    return { whereSql: '', args: [] }
  }

  const clauses: string[] = []
  const args: SqlValue[] = []
  const byName = new Map(plan.columns.map((c) => [c.name, c]))

  for (const [key, value] of Object.entries(where)) {
    const col = byName.get(key)
    if (key === 'id') {
      clauses.push('"id" = ?')
      args.push(String(value))
      continue
    }
    if (!col) continue
    clauses.push(`"${key}" = ?`)
    args.push(toSql(col.kind, value))
  }

  if (clauses.length === 0) return { whereSql: '', args: [] }
  return { whereSql: ` WHERE ${clauses.join(' AND ')}`, args }
}

function buildSelect(
  plan: TablePlan,
  query: Query,
): { sql: string; args: SqlValue[] } {
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
    sql += ` LIMIT ?`
    args.push(query.limit)
    if (query.offset !== undefined) {
      sql += ` OFFSET ?`
      args.push(query.offset)
    }
  }

  return { sql, args }
}

/** Create a Turso/libsql-backed DBAdapter. */
export function tursoAdapter(options: TursoAdapterOptions): DBAdapter {
  return new TursoAdapter(options)
}
