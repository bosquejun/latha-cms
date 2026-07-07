/**
 * Session runtime configuration — where the HMAC secret, cookie name, and
 * session TTL come from. Shared by this module's own login/logout/session
 * routes and by `@latha/start`'s generic principal resolution, so both sides
 * agree on the same secret and cookie without duplicating the lookup.
 */
import { DEFAULT_COOKIE_NAME, type AuthOptions } from './service.js'
import { DEFAULT_SESSION_TTL_SECONDS } from './session.js'

// Avoid a hard @types/node dependency for one env var.
declare const process: { env: Record<string, string | undefined> }

/** Dev fallback — set `AUTH_SECRET` in production. */
export const DEV_SECRET = 'latha-dev-secret-change-me'

export interface ResolvedAuthOptions extends AuthOptions {
  cookieName: string
  sessionTtlSeconds: number
}

/** Resolve session config from the environment. Throws in production without `AUTH_SECRET`. */
export function resolveAuthOptions(): ResolvedAuthOptions {
  const secret = process.env['AUTH_SECRET']
  if (!secret && process.env['NODE_ENV'] === 'production') {
    throw new Error('[latha] AUTH_SECRET environment variable is required in production.')
  }
  return {
    secret: secret ?? DEV_SECRET,
    cookieName: DEFAULT_COOKIE_NAME,
    sessionTtlSeconds: DEFAULT_SESSION_TTL_SECONDS,
  }
}
