/**
 * Adapter interfaces. DB, storage, and auth are all swappable. Nothing in the
 * kernel is tied to a specific vendor.
 */

import type { AnyEntity } from './entity.js'

/** A JSON-serializable value — the wire shape of any persisted field. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface QuerySort {
  field: string
  direction: 'asc' | 'desc'
}

export interface Query {
  /** Equality filters keyed by field name. */
  where?: Record<string, unknown>
  limit?: number
  offset?: number
  sort?: QuerySort[]
}

/** A persisted record. Always carries a string `id`. */
export type Doc = Record<string, unknown> & { id: string }

export interface DBAdapter {
  /** Establish the connection / run any one-time setup. */
  connect?(): Promise<void>
  /** Tear down the connection. */
  disconnect?(): Promise<void>

  find(slug: string, query?: Query): Promise<Doc[]>
  findOne(slug: string, id: string): Promise<Doc | null>
  count(slug: string, query?: Query): Promise<number>
  create(slug: string, data: Record<string, unknown>): Promise<Doc>
  update(
    slug: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Doc>
  delete(slug: string, id: string): Promise<void>

  /** Reconcile the database schema with the given entity definitions. */
  migrate(entities: AnyEntity[]): Promise<void>
}

export interface StorageAdapter {
  upload(file: File): Promise<{ url: string; key: string }>
  delete(key: string): Promise<void>
}

/**
 * A generic key-value cache. Vendor-agnostic — core has no opinion on what's
 * cached or by whom; a module or a runner wires it up and decides. Values are
 * JSON-serializable so an implementation can be backed by an external store
 * (e.g. Redis) as easily as an in-process Map.
 */
export interface CacheAdapter {
  get(key: string): Promise<JsonValue | undefined>
  /** Store `value` under `key`. `ttlSeconds`, when given, expires the entry. */
  set(key: string, value: JsonValue, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
}
