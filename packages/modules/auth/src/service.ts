/**
 * Auth service — credential verification and session → user resolution.
 *
 * Users are stored in the `users` collection (contributed by `@latha/users`),
 * so auth reaches them through the kernel's local operations: it needs only
 * `@latha/core`, not a direct dependency on the users package.
 */

import { operations } from '@latha/core'
import type { AuthUser, LathaInstance } from '@latha/core'
import { verifyPassword } from './crypto.js'
import { verifySessionToken } from './session.js'

export const USERS_SLUG = 'users'
export const DEFAULT_COOKIE_NAME = 'latha_session'

export interface AuthOptions {
  secret: string
  cookieName?: string
  sessionTtlSeconds?: number
}

/** Strip the password hash before a user record leaves the server boundary. */
export function toAuthUser(doc: Record<string, unknown>): AuthUser {
  const { passwordHash: _passwordHash, ...rest } = doc
  return rest as AuthUser
}

const systemCtx = (latha: LathaInstance) => ({
  cms: latha,
  // Run lookups as the system (bypass per-collection access for auth itself).
  user: { id: '__system__', role: 'admin' },
})

/** Look up a user by email, including the stored password hash. */
export async function findUserByEmail(
  latha: LathaInstance,
  email: string,
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const matches = await operations.find(systemCtx(latha), USERS_SLUG, {
    where: { email },
    limit: 1,
  })
  return matches[0] ?? null
}

/** Verify an email + password pair. Returns the auth user, or `null`. */
export async function authenticate(
  latha: LathaInstance,
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const user = await findUserByEmail(latha, email)
  if (!user) return null
  const hash = user.passwordHash
  if (typeof hash !== 'string') return null
  const ok = await verifyPassword(password, hash)
  return ok ? toAuthUser(user) : null
}

/** Load a user by id (e.g. from a verified session). */
export async function getUserById(
  latha: LathaInstance,
  id: string,
): Promise<AuthUser | null> {
  const doc = await operations.findOne(systemCtx(latha), USERS_SLUG, id)
  return doc ? toAuthUser(doc) : null
}

/** Parse a `Cookie` header into a name → value map. */
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const name = part.slice(0, eq).trim()
    if (name) out[name] = decodeURIComponent(part.slice(eq + 1).trim())
  }
  return out
}

/** Resolve the user for a request from its session cookie, or `null`. */
export async function getSessionUser(
  request: Request,
  options: AuthOptions,
  latha: LathaInstance,
): Promise<AuthUser | null> {
  const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME
  const token = parseCookies(request.headers.get('cookie'))[cookieName]
  if (!token) return null
  const payload = await verifySessionToken(token, options.secret)
  if (!payload) return null
  return getUserById(latha, payload.sub)
}
