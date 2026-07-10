/**
 * Framework-owned RPC endpoint. A single server route handles the whole Studio
 * surface, so the consuming app needs no hand-written `createServerFn` — the
 * default client (`createKon10Client()`) just POSTs here.
 *
 * Apps get it for free via the `kon10Start()` Vite plugin (mounted at
 * `DEFAULT_RPC_PATH`). The handler is server-only; both the app config and the
 * server-only dispatcher are pulled in with dynamic `import()` so neither ever
 * reaches the client bundle.
 *
 * `virtual:kon10/config` is resolved by `kon10Start()` to the app's
 * `kon10.config` module.
 */
import { createFileRoute } from '@tanstack/react-router'

// The route id must be a string literal — TanStack's router generator parses it
// statically. Keep it in sync with `DEFAULT_RPC_PATH` in `default-rpc.ts`.
// Built standalone (no app router typegen), so the literal path + server option
// are cast.
export const Route = (createFileRoute as (path: string) => any)('/__kon10/rpc')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const [{ default: config }, { dispatchKon10Rpc, rejectUntrustedOrigin }] =
          await Promise.all([import('virtual:kon10/config'), import('../server.js')])
        // Cookie-authenticated endpoint: refuse cross-origin browser POSTs.
        const rejected = rejectUntrustedOrigin(request)
        if (rejected) return rejected
        // Pass raw JSON — dispatchKon10Rpc validates shape with Zod before dispatch.
        const data: unknown = await request.json()
        const result = await dispatchKon10Rpc(config, data, request)
        return Response.json(result)
      },
    },
  },
})
