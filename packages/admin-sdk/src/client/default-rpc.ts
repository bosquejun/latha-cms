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

/**
 * Where the framework's file-upload server route is mounted. Binary payloads
 * can't go through the JSON-only RPC route, so uploads (see `@latha/media`)
 * get their own dedicated multipart endpoint.
 */
export const DEFAULT_UPLOAD_PATH = '/__latha/upload'

/**
 * Where the public content delivery API is mounted — the read-only REST
 * surface headless consumers fetch, as opposed to the admin-gated RPC above.
 * Versioned so the envelope/query semantics can evolve as `/api/v2` alongside
 * a still-working v1; the segment must stay in sync with the route literal in
 * `@latha/start`'s `routes/api.ts`.
 */
export const DEFAULT_API_PATH = '/api/v1'

/** Identity validator that pins a custom server function's input to `LathaRpcInput`. */
export function lathaRpcValidator(data: LathaRpcInput): LathaRpcInput {
  return data
}
