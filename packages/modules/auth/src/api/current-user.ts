/**
 * `GET auth/current-user` — the signed-in user for this request, or `null`
 * for an anonymous caller. Public: this route *is* how a caller finds out
 * whether it has a session.
 */
import type { ModuleRoute, ModuleRouteContext } from '@latha/core'
import { getSessionUser } from '../service.js'
import { resolveAuthOptions } from '../config.js'
import { toSessionUser } from './session-user.js'

async function handleCurrentUser({ cms, request }: ModuleRouteContext): Promise<Response> {
  const user = await getSessionUser(request, resolveAuthOptions(), cms)
  return Response.json(user ? toSessionUser(user) : null)
}

export const currentUserRoute: ModuleRoute = { method: 'GET', handler: handleCurrentUser }
