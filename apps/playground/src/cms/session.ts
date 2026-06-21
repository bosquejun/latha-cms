/**
 * Server-only session helpers.
 *
 * This module imports `@tanstack/react-start/server` (cookie access), which is
 * forbidden in client bundles — so nothing client-reachable may import it
 * statically. It is loaded via dynamic `import()` from inside server-function
 * handlers, keeping it out of the client graph entirely.
 */

import { getCookie, setCookie } from '@tanstack/react-start/server'
import {
  authenticate,
  createSessionToken,
  getUserById,
  verifySessionToken,
  DEFAULT_COOKIE_NAME,
  DEFAULT_SESSION_TTL_SECONDS,
} from '@latha/auth'
import type { AuthUser } from '@latha/core'
import { getLatha } from './instance'
import { AUTH_SECRET } from './config'

const COOKIE = DEFAULT_COOKIE_NAME

/** Resolve the full auth user for the current request, or `null`. */
export async function currentAuthUser(): Promise<AuthUser | null> {
  const token = getCookie(COOKIE)
  if (!token) return null
  const payload = await verifySessionToken(token, AUTH_SECRET)
  if (!payload) return null
  return getUserById(await getLatha(), payload.sub)
}

/** Verify credentials and, on success, set the session cookie. */
export async function signIn(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const latha = await getLatha()
  const user = await authenticate(latha, email, password)
  if (!user) return null

  const token = await createSessionToken(
    { sub: user.id, role: user.role },
    AUTH_SECRET,
  )
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DEFAULT_SESSION_TTL_SECONDS,
  })
  return user
}

/** Clear the session cookie. */
export function signOut(): void {
  setCookie(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}
