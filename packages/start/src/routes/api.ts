/**
 * Framework-owned public delivery API endpoint — the read-only REST surface
 * headless consumers fetch (`GET /api/:slug[/:id]`), as opposed to the
 * admin-gated RPC route.
 *
 * Injected by the `lathaStart()` Vite plugin (mounted at `DEFAULT_API_PATH`;
 * pass `api: false` to disable). Server-only: config and dispatcher are pulled
 * in with dynamic `import()` so neither reaches the client bundle.
 */
import { createFileRoute } from '@tanstack/react-router'

// The route id must be a string literal — TanStack's router generator parses
// it statically. Keep it in sync with `DEFAULT_API_PATH` in `default-rpc.ts`.
export const Route = (createFileRoute as (path: string) => any)('/api/$')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const [{ default: config }, { handleDeliveryRequest }] = await Promise.all([
          import('virtual:latha/config'),
          import('../api.js'),
        ])
        return handleDeliveryRequest(config, request)
      },
      OPTIONS: async ({ request }: { request: Request }) => {
        const [{ default: config }, { handleDeliveryPreflight }] = await Promise.all([
          import('virtual:latha/config'),
          import('../api.js'),
        ])
        return handleDeliveryPreflight(config, request)
      },
    },
  },
})
