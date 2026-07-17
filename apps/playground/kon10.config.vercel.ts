/**
 * kon10.config.vercel.ts — Vercel deploy entrypoint.
 *
 * @libsql/client (Turso's driver, used by `kon10.config.ts`) dynamically
 * requires a platform-specific native binding that doesn't survive
 * serverless bundling/tracing. Kysely's Postgres dialect (the `pg` driver)
 * is pure JS/TCP with zero native dependencies, so it sidesteps the problem
 * entirely — works against a self-hosted Postgres or Supabase; for Supabase
 * on Vercel, use the *pooled* connection string (`pg`'s unnamed prepared
 * statements are compatible with pgBouncer's transaction mode as-is).
 *
 * Media storage is likewise swapped for `s3Storage`: `localDiskStorage`
 * writes into `public/uploads`, which doesn't persist on Vercel's serverless
 * filesystem (every cold start gets a fresh one). `s3Storage` works against
 * any S3-compatible provider — Cloudflare R2, Supabase Storage, AWS S3, etc.
 * — over signed HTTP requests, no native deps either.
 *
 * Same reasoning for the delivery-API cache: `inMemoryCache()` (used in
 * `kon10.config.ts`) is single-process, and Vercel serverless functions
 * don't share process state across invocations, so `redisCache()` is used
 * here instead — a real shared cache every invocation reads/writes through.
 *
 * `vite.config.ts` picks this entrypoint only when `process.env.VERCEL` is
 * set, so `kon10.config.ts` (and @libsql/client) is never part of this
 * build's module graph at all — not a runtime branch inside one bundle.
 */

import { postgresAdapter } from '@kon10/storage'
import { s3Storage } from '@kon10/media'
import { redisCache } from '@kon10/cache'
import { buildConfig } from './kon10.config.base.js'

export default buildConfig(
  postgresAdapter({
    url: process.env.DATABASE_URL!,
  }),
  s3Storage({
    bucket: process.env.S3_BUCKET!,
    region: process.env.S3_REGION ?? 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    endpoint: process.env.S3_ENDPOINT,
    publicUrl: process.env.S3_PUBLIC_URL,
  }),
  redisCache({ url: process.env.REDIS_URL }),
)
