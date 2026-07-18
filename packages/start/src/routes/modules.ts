/**
 * Framework-owned catch-all for module-contributed routes. A module declares
 * `routes` on its `Module` object (see `ModuleRoutes` in `kon10`) and
 * this single server route dispatches to them — the consuming app and
 * `@kon10/start` itself need no per-module wiring.
 *
 * Injected by the `kon10Start()` Vite plugin (mounted at
 * `DEFAULT_MODULE_ROUTES_PATH`). Server-only: config and dispatcher are
 * pulled in with dynamic `import()` so neither reaches the client bundle.
 */
import { createFileRoute } from '@tanstack/react-router'

// The route id must be a string literal — TanStack's router generator parses
// it statically. Keep it in sync with `DEFAULT_MODULE_ROUTES_PATH` in
// `module-routes.ts`.
const dispatch = async ({ request }: { request: Request }) => {
  const [{ default: config }, { handleModuleRoute }, { rejectUntrustedOrigin }] =
    await Promise.all([
      import('virtual:kon10/config'),
      import('../module-routes.js'),
      import('../server.js'),
    ])
  // Cookie-authenticated endpoint: refuse cross-origin browser POSTs.
  const rejected = rejectUntrustedOrigin(request)
  if (rejected) return rejected
  return handleModuleRoute(config, request)
}

export const Route = (createFileRoute as (path: string) => any)('/__kon10/modules/$')({
  server: {
    handlers: {
      GET: dispatch,
      POST: dispatch,
      PUT: dispatch,
      PATCH: dispatch,
      DELETE: dispatch,
      OPTIONS: dispatch,
    },
  },
})
