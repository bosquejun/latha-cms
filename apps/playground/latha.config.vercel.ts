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
 * Media storage is likewise swapped for `s3Storage`: `localDiskStorage`
 * writes into `public/uploads`, which doesn't persist on Vercel's serverless
 * filesystem (every cold start gets a fresh one). `s3Storage` works against
 * any S3-compatible provider — Cloudflare R2, Supabase Storage, AWS S3, etc.
 * — over signed HTTP requests, no native deps either.
 *
 * `vite.config.ts` picks this entrypoint only when `process.env.VERCEL` is
 * set, so `latha.config.ts` (and @libsql/client) is never part of this
 * build's module graph at all — not a runtime branch inside one bundle.
 */

import { postgresAdapter } from '@latha/storage'
import { s3Storage } from '@latha/media'
import { buildConfig } from './latha.config.base.js'

export default buildConfig(
  postgresAdapter({
    url: process.env.DATABASE_URL!,
    prepare: false,
  }),
  s3Storage({
    bucket: process.env.S3_BUCKET!,
    region: process.env.S3_REGION ?? 'auto',
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    endpoint: process.env.S3_ENDPOINT,
    publicUrl: process.env.S3_PUBLIC_URL,
  }),
)
