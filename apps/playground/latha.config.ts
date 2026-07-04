/**
 * latha.config.ts — local dev entrypoint.
 *
 * Turso's `file:` mode needs no running database at all, so this is the
 * default `vite.config.ts` picks whenever the build isn't running on Vercel.
 * See `latha.config.vercel.ts` for the Postgres entrypoint used there, and
 * `latha.config.base.ts` for everything the two share.
 */

import { tursoAdapter } from '@latha/storage'
import { buildConfig } from './latha.config.base.js'

export default buildConfig(
  tursoAdapter({
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
)
