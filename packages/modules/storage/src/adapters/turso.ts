/**
 * tursoAdapter() — the default DBAdapter.
 *
 * Backed by Kysely over Turso's first-party `@libsql/kysely-libsql` dialect,
 * which speaks to Turso over HTTP and also supports local `file:` URLs — so the
 * same adapter runs in production (Turso) and in local dev / tests (a SQLite
 * file or `:memory:`).
 *
 * All query, migration, and marshaling logic lives in the shared
 * {@link ./kysely-adapter.js | KyselyAdapter}; this factory only wires the
 * SQLite dialect.
 */

import { Kysely } from 'kysely'
import { LibsqlDialect } from '@libsql/kysely-libsql'
import type { DBAdapter } from '@kon10/core'
import { KyselyAdapter } from './kysely-adapter.js'

export interface TursoAdapterOptions {
  /** libsql URL — e.g. `libsql://db.turso.io`, `file:local.db`, or `:memory:`. */
  url: string
  /** Turso auth token. Omit for local file / in-memory databases. */
  authToken?: string
}

/** Create a Turso/libsql-backed DBAdapter. */
export function tursoAdapter(options: TursoAdapterOptions): DBAdapter {
  const db = new Kysely<any>({
    dialect: new LibsqlDialect({
      url: options.url,
      authToken: options.authToken,
    }),
  })
  return new KyselyAdapter(db, 'sqlite')
}
