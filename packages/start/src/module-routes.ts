/**
 * Generic dispatcher for module-contributed HTTP routes.
 *
 * `@latha/start` mounts this once and never needs module-specific knowledge to
 * serve it: it resolves the caller, looks up `<moduleName>/<path>` against
 * that module's declared `routes`, applies the route's `requireAdmin` gate
 * (the one check a module can't perform itself without importing an auth
 * package), and calls the handler. Everything else — what the route does,
 * which entity it touches — is the module's business, not this runner's.
 */
import type { ModuleRoute, ResolvedConfig } from '@latha/core'
import { hasPermission, ADMIN_ACCESS } from '@latha/auth'
import { getRuntime } from './runtime.js'
import { resolvePrincipal } from './server.js'

/** Where the runner mounts module-contributed routes, one module per segment. */
export const DEFAULT_MODULE_ROUTES_PATH = '/__latha/modules'

function json(status: number, body: unknown): Response {
  return Response.json(body, { status })
}

/** Dispatch one request to a module's declared route. `basePath` defaults to `DEFAULT_MODULE_ROUTES_PATH`. */
export async function handleModuleRoute(
  config: ResolvedConfig,
  request: Request,
  basePath: string = DEFAULT_MODULE_ROUTES_PATH,
): Promise<Response> {
  const url = new URL(request.url)
  const rest = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : ''
  const segments = rest.split('/').filter(Boolean).map(decodeURIComponent)
  if (segments.length < 2) return json(404, { error: 'Not found.' })
  const [moduleName, ...pathParts] = segments as [string, ...string[]]
  const path = pathParts.join('/')

  const latha = await getRuntime(config)
  const module = latha.modules.find((m) => m.name === moduleName)
  const entry = module?.routes?.[path]
  if (!entry) return json(404, { error: 'Not found.' })

  const candidates: ModuleRoute[] = Array.isArray(entry) ? entry : [entry]
  const route = candidates.find((r) => r.method === request.method)
  if (!route) return json(405, { error: 'Method not allowed.' })

  const { principal } = await resolvePrincipal(latha)
  if (route.requireAdmin && !hasPermission(principal, ADMIN_ACCESS)) {
    return json(403, { error: 'Forbidden.' })
  }

  try {
    return await route.handler({ cms: latha, principal, request })
  } catch (err) {
    // Policy rejections and access denials are client errors, not server
    // faults — surface the message with a 4xx, same contract module route
    // handlers relied on when this lived in `dispatchLathaUpload`.
    const status = err instanceof Error && err.name === 'AccessDeniedError' ? 403 : 400
    const message = err instanceof Error ? err.message : 'Request failed.'
    return json(status, { error: message })
  }
}
