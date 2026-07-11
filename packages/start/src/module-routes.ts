/**
 * Generic dispatcher for module-contributed HTTP routes.
 *
 * `@kon10/start` mounts this once and never needs module-specific knowledge to
 * serve it: it resolves the caller, looks up `<moduleName>/<path>` against
 * that module's declared `routes`, applies the route's `requireStudioAccess`
 * gate (the one check a module can't perform itself without importing an auth
 * package), and calls the handler. Everything else — what the route does,
 * which entity it touches — is the module's business, not this runner's.
 */
import type { ModuleRoute, ResolvedConfig } from '@kon10/core'
import { hasPermission, STUDIO_ACCESS } from '@kon10/auth'
import { getRuntime } from './runtime.js'
import { resolvePrincipal } from './server.js'

/** Where the runner mounts module-contributed routes, one module per segment. */
export const DEFAULT_MODULE_ROUTES_PATH = '/__kon10/modules'

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

  let kon10
  try {
    kon10 = await getRuntime(config)
  } catch (err) {
    console.error('[kon10] runtime bootstrap failed:', err)
    const message = err instanceof Error ? err.message : 'Runtime bootstrap failed.'
    return json(500, { error: message })
  }
  const module = kon10.modules.find((m) => m.name === moduleName)
  const entry = module?.routes?.[path]
  if (!entry) return json(404, { error: 'Not found.' })

  const candidates: ModuleRoute[] = Array.isArray(entry) ? entry : [entry]
  const route = candidates.find((r) => r.method === request.method)
  if (!route) return json(405, { error: 'Method not allowed.' })

  const { principal } = await resolvePrincipal(kon10, request)
  if (route.requireStudioAccess && !hasPermission(principal, STUDIO_ACCESS)) {
    return json(403, { error: 'Forbidden.' })
  }

  try {
    return await route.handler({ cms: kon10, principal, request })
  } catch (err) {
    // Policy rejections and access denials are client errors, not server
    // faults — surface the message with a 4xx.
    const status = err instanceof Error && err.name === 'AccessDeniedError' ? 403 : 400
    const message = err instanceof Error ? err.message : 'Request failed.'
    return json(status, { error: message })
  }
}
