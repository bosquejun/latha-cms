/**
 * Framework-owned upload route. Binary uploads can't go through the
 * JSON-only `/__latha/rpc` route (see `routes/rpc.ts`), so this is a sibling
 * server route for multipart file uploads, injected by `lathaStart()`.
 * `virtual:latha/config` is resolved by `lathaStart()` to the app's
 * `latha.config` module.
 */
import { createFileRoute } from '@tanstack/react-router'

// The route id must be a string literal — see the note in `routes/rpc.ts`.
export const Route = (createFileRoute as (path: string) => any)('/__latha/upload')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ default: config }, { dispatchLathaUpload }] = await Promise.all([
          import('virtual:latha/config'),
          import('../upload.js'),
        ])
        const result = await dispatchLathaUpload(config, request)
        return Response.json(result)
      },
    },
  },
})
