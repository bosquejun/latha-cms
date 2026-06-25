/**
 * Framework-owned RPC endpoint. A single server route handles the whole admin
 * surface, so the consuming app needs no hand-written `createServerFn` — the
 * default client (`createLathaClient()`) just POSTs here.
 *
 * Apps get it for free via the `lathaStart()` Vite plugin (mounted at
 * `DEFAULT_RPC_PATH`). The handler is server-only; both the app config and the
 * server-only dispatcher are pulled in with dynamic `import()` so neither ever
 * reaches the client bundle.
 *
 * `virtual:latha/config` is resolved by `lathaStart()` to the app's
 * `latha.config` module.
 */
import { createFileRoute } from '@tanstack/react-router'
import type { LathaRpcInput } from '@latha/admin-sdk'

// The route id must be a string literal — TanStack's router generator parses it
// statically. Keep it in sync with `DEFAULT_RPC_PATH` in `default-rpc.ts`.
// Built standalone (no app router typegen), so the literal path + server option
// are cast.
export const Route = (createFileRoute as (path: string) => any)('/__latha/rpc')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const data = (await request.json()) as LathaRpcInput
        const [{ default: config }, { dispatchLathaRpc }] = await Promise.all([
          import('virtual:latha/config'),
          import('../server.js'),
        ])
        const result = await dispatchLathaRpc(config, data)
        return Response.json(result)
      },
    },
  },
})
