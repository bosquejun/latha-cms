/**
 * postgresAdapter() — a Postgres / Supabase DBAdapter.
 *
 * Backed by Kysely over its official `PostgresDialect` (the `pg` driver).
 * Supabase is standard Postgres, so the same adapter serves a self-hosted
 * instance and Supabase; for serverless / Vercel deployments use Supabase's
 * *pooled* connection string.
 *
 * All query, migration, and marshaling logic lives in the shared
 * {@link ./kysely-adapter.js | KyselyAdapter}; this factory only wires the
 * Postgres dialect and connection pool.
 */

import { Kysely, PostgresDialect } from 'kysely'
import { Pool, type PoolConfig } from 'pg'
import type { DBAdapter } from 'kon10'
import { KyselyAdapter } from './kysely-adapter.js'

export interface PostgresAdapterOptions {
  /** Postgres connection string, e.g. `postgres://user:pass@host:5432/db`. */
  url: string
  /** Max pool connections. Defaults to the driver default. */
  max?: number
  /** SSL configuration passed through to the driver (e.g. `{ rejectUnauthorized: false }`). */
  ssl?: PoolConfig['ssl']
}

/** Create a Postgres / Supabase-backed DBAdapter. */
export function postgresAdapter(options: PostgresAdapterOptions): DBAdapter {
  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: options.url,
        max: options.max,
        ssl: options.ssl,
      }),
    }),
  })
  return new KyselyAdapter(db, 'postgres')
}
