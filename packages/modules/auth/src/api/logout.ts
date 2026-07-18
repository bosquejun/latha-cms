/**
 * `POST auth/logout` — clear the session cookie. Public: logging out never
 * requires already being logged in.
 */
import type { ModuleRoute, ModuleRouteContext } from 'kon10'
import { resolveAuthOptions } from '../config.js'
import { serializeSetCookie } from '../cookie.js'

// Avoid a hard @types/node dependency for one env var.
declare const process: { env: Record<string, string | undefined> }

async function handleLogout(_ctx: ModuleRouteContext): Promise<Response> {
  const opts = resolveAuthOptions()
  const cookie = serializeSetCookie(opts.cookieName, '', {
    httpOnly: true,
    secure: process.env['NODE_ENV'] !== 'development',
    path: '/',
    maxAge: 0,
  })
  return Response.json({ ok: true }, { headers: { 'set-cookie': cookie } })
}

export const logoutRoute: ModuleRoute = { method: 'POST', handler: handleLogout }
