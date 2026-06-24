/**
 * Auth service — credential verification and session → user resolution.
 *
 * Auth reaches identities through a pluggable `SubjectStore` (see
 * `subject-store.ts`), not a hard dependency on the users module: the default
 * store reads the `users` collection, but an app can point it elsewhere or
 * supply a custom store.
 */

import type { LathaInstance } from '@latha/core'
import type { AuthUser } from './types.js'
import { verifyPassword } from './crypto.js'
import { verifySessionToken } from './session.js'
import { resolveUserPermissions } from './rbac/resolve.js'
import { getSubjectStore, DEFAULT_USERS_SLUG } from './subject-store.js'

/** @deprecated The subject collection is configurable; this is only the default. */
export const USERS_SLUG = DEFAULT_USERS_SLUG
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

/** Look up a user by email, including the stored password hash. */
export async function findUserByEmail(
  latha: LathaInstance,
  email: string,
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const subject = await getSubjectStore(latha).findByEmail(email)
  return subject ? (subject as Record<string, unknown> & { id: string }) : null
}

/** Enrich a stripped user with its resolved roles + effective permissions. */
async function withGrants(
  latha: LathaInstance,
  doc: Record<string, unknown>,
): Promise<AuthUser> {
  const base = toAuthUser(doc)
  const { roles, permissions } = await resolveUserPermissions(latha, doc)
  return { ...base, roles, permissions }
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
  return ok ? withGrants(latha, user) : null
}

/** Load a user by id (e.g. from a verified session), with roles + permissions. */
export async function getUserById(
  latha: LathaInstance,
  id: string,
): Promise<AuthUser | null> {
  const doc = await getSubjectStore(latha).findById(id)
  return doc ? withGrants(latha, doc) : null
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
