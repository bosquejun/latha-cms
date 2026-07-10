/**
 * Framework-owned public delivery API endpoint — the read-only REST surface
 * headless consumers fetch (`GET /api/v1/:slug[/:id]`), as opposed to the
 * Studio-gated RPC route.
 *
 * Injected by the `kon10Start()` Vite plugin (mounted at `DEFAULT_API_PATH`;
 * pass `api: false` to disable). Server-only: config and dispatcher are pulled
 * in with dynamic `import()` so neither reaches the client bundle.
 */
import { createFileRoute } from '@tanstack/react-router'

// The route id must be a string literal — TanStack's router generator parses
// it statically. Keep it in sync with `DEFAULT_API_PATH` in `default-rpc.ts`.
// Every write method gets an explicit handler: without one, TanStack falls
// through to SSR and answers a POST with the HTML shell instead of a 405
// (`handleDeliveryRequest` rejects non-GET itself).
const dispatch = async ({ request }: { request: Request }) => {
  const [{ default: config }, { handleDeliveryRequest }] = await Promise.all([
    import('virtual:kon10/config'),
    import('../api.js'),
  ])
  return handleDeliveryRequest(config, request)
}

export const Route = (createFileRoute as (path: string) => any)('/api/v1/$')({
  server: {
    handlers: {
      GET: dispatch,
      POST: dispatch,
      PUT: dispatch,
      PATCH: dispatch,
      DELETE: dispatch,
      // Only reached in production — Vite's dev middleware answers preflights
      // itself in dev.
      OPTIONS: async ({ request }: { request: Request }) => {
        const [{ default: config }, { handleDeliveryPreflight }] = await Promise.all([
          import('virtual:kon10/config'),
          import('../api.js'),
        ])
        return handleDeliveryPreflight(config, request)
      },
    },
  },
})
