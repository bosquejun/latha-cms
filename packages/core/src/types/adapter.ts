/**
 * Adapter interfaces. DB, storage, and auth are all swappable. Nothing in the
 * kernel is tied to a specific vendor.
 */

import type { Entity } from './collection.js'

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

  find(collection: string, query?: Query): Promise<Doc[]>
  findOne(collection: string, id: string): Promise<Doc | null>
  count(collection: string, query?: Query): Promise<number>
  create(collection: string, data: Record<string, unknown>): Promise<Doc>
  update(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Doc>
  delete(collection: string, id: string): Promise<void>

  /** Reconcile the database schema with the given entity definitions. */
  migrate(entities: Entity<any>[]): Promise<void>
}

export interface StorageAdapter {
  upload(file: File): Promise<{ url: string; key: string }>
  delete(key: string): Promise<void>
}
