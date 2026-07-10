/**
 * latha.config.ts — local dev entrypoint.
 *
 * Turso's `file:` mode needs no running database at all, so this is the
 * default `vite.config.ts` picks whenever the build isn't running on Vercel.
 * Media likewise uses local disk here — there's a real, persistent
 * filesystem in dev. The delivery-API cache uses `inMemoryCache()`: a single
 * dev process is the only reader/writer, so nothing needs to be shared. See
 * `latha.config.vercel.ts` for the Postgres/S3/Redis entrypoint used on
 * Vercel, and `latha.config.base.ts` for everything the two share.
 */

import { tursoAdapter } from '@latha/storage'
import { localDiskStorage } from '@latha/media'
import { inMemoryCache } from '@latha/cache'
import { buildConfig } from './latha.config.base.js'

export default buildConfig(
  tursoAdapter({
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  localDiskStorage({ dir: './public/uploads', publicPath: '/uploads' }),
  inMemoryCache(),
)
