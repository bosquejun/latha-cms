/**
 * kon10.config.ts — local dev entrypoint.
 *
 * Turso's `file:` mode needs no running database at all, so this is the
 * default `vite.config.ts` picks whenever the build isn't running on Vercel.
 * Media likewise uses local disk here — there's a real, persistent
 * filesystem in dev. The delivery-API cache uses `inMemoryCache()`: a single
 * dev process is the only reader/writer, so nothing needs to be shared. See
 * `kon10.config.vercel.ts` for the Postgres/S3/Redis entrypoint used on
 * Vercel. Shared project configuration lives under `src/kon10`.
 */

import { tursoAdapter } from '@kon10/storage'
import { localDiskStorage } from '@kon10/media'
import { inMemoryCache } from '@kon10/cache'
import { createKon10Config } from './src/kon10/config.js'

export default createKon10Config({
  db: tursoAdapter({
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  storage: localDiskStorage({ dir: './public/uploads', publicPath: '/uploads' }),
  cache: inMemoryCache(),
})
