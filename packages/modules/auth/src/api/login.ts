/**
 * `POST auth/login` — verify credentials and start a session.
 *
 * Public (no `requireStudioAccess`): a caller isn't logged in yet by definition. Sets
 * the session cookie directly on the returned `Response` — no framework
 * cookie helper needed, so this route runs the same whether the runner is
 * TanStack Start or anything else that speaks Fetch `Request`/`Response`.
 */
import type { ModuleRoute, ModuleRouteContext } from '@kon10/core'
import { authenticate } from '../service.js'
import { createSessionToken } from '../session.js'
import { resolveAuthOptions } from '../config.js'
import { serializeSetCookie } from '../cookie.js'
import { loginBlocked, recordLoginFailure, clearLoginFailures } from '../login-throttle.js'
import { toSessionUser } from './session-user.js'

// Avoid a hard @types/node dependency for one env var.
declare const process: { env: Record<string, string | undefined> }

async function handleLogin({ cms, request }: ModuleRouteContext): Promise<Response> {
  const body = (await request.json()) as { email?: unknown; password?: unknown }
  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (loginBlocked(email)) {
    return Response.json({
      ok: false,
      user: null,
      error: 'Too many failed attempts. Try again in a few minutes.',
    })
  }

  const user = await authenticate(cms, email, password)
  if (!user) {
    recordLoginFailure(email)
    return Response.json({ ok: false, user: null })
  }
  clearLoginFailures(email)

  const opts = resolveAuthOptions()
  const token = await createSessionToken({ sub: user.id }, opts.secret, opts.sessionTtlSeconds)
  const cookie = serializeSetCookie(opts.cookieName, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: opts.sessionTtlSeconds,
  })

  return Response.json(
    { ok: true, user: toSessionUser(user) },
    { headers: { 'set-cookie': cookie } },
  )
}

export const loginRoute: ModuleRoute = { method: 'POST', handler: handleLogin }
