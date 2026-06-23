/**
 * Client-safe pieces of the Latha RPC endpoint.
 *
 * The endpoint itself is a package-owned server route (see `routes/rpc.ts`),
 * injected by `lathaStart()`. The default client (in `client.ts`) just POSTs to
 * `DEFAULT_RPC_PATH`, so a consuming app needs no hand-written server function —
 * `createLathaClient()` works out of the box. `lathaRpcValidator` remains for
 * apps that still want to wire their own `createServerFn` endpoint.
 */

import type { LathaRpcInput } from './rpc.js'

/** Where the framework's RPC server route is mounted. */
export const DEFAULT_RPC_PATH = '/__latha/rpc'

/** Identity validator that pins a custom server function's input to `LathaRpcInput`. */
export function lathaRpcValidator(data: LathaRpcInput): LathaRpcInput {
  return data
}
