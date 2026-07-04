/**
 * latha.config.vercel.ts — Vercel deploy entrypoint.
 *
 * @libsql/client (Turso's driver, used by `latha.config.ts`) dynamically
 * requires a platform-specific native binding that doesn't survive
 * serverless bundling/tracing. The `postgres` (porsager) driver is pure
 * JS/TCP with zero native dependencies, so it sidesteps the problem
 * entirely — works against a self-hosted Postgres or Supabase; for Supabase
 * on Vercel, use the *pooled* connection string (`prepare: false` below is
 * required for pgBouncer's transaction mode).
 *
 * `vite.config.ts` picks this entrypoint only when `process.env.VERCEL` is
 * set, so `latha.config.ts` (and @libsql/client) is never part of this
 * build's module graph at all — not a runtime branch inside one bundle.
 */

import { postgresAdapter } from '@latha/storage'
import { buildConfig } from './latha.config.base.js'

export default buildConfig(
  postgresAdapter({
    url: process.env.DATABASE_URL!,
    prepare: false,
  }),
)
