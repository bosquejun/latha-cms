/**
 * Client-safe pieces of the Kon10 RPC endpoint.
 *
 * The endpoint itself is a package-owned server route (see `routes/rpc.ts`),
 * injected by `kon10Start()`. The default client (in `client.ts`) just POSTs to
 * `DEFAULT_RPC_PATH`, so a consuming app needs no hand-written server function —
 * `createKon10Client()` works out of the box. `kon10RpcValidator` remains for
 * apps that still want to wire their own `createServerFn` endpoint.
 */

import type { Kon10RpcInput } from './rpc.js'

/** Where the framework's RPC server route is mounted. */
export const DEFAULT_RPC_PATH = '/__kon10/rpc'

/**
 * Where `@kon10/media`'s upload endpoint is mounted. Binary payloads can't go
 * through the JSON-only RPC route, so uploads get their own dedicated
 * multipart endpoint — declared by the media module itself as a route (see
 * `ModuleRoutes` in `@kon10/core`) at `<module.name>/upload`, and served by
 * the runner's generic module-route dispatcher under
 * `DEFAULT_MODULE_ROUTES_PATH`.
 */
export const DEFAULT_UPLOAD_PATH = '/__kon10/modules/media/upload'

/**
 * Where `@kon10/auth`'s login/logout/current-user endpoints are mounted.
 * These are ordinary module routes (see `ModuleRoutes` in `@kon10/core`),
 * declared by the auth module itself at `<module.name>/login` etc. and
 * served by the runner's generic module-route dispatcher — not special-cased
 * RPC actions, since they must run without an existing Studio session.
 */
export const DEFAULT_LOGIN_PATH = '/__kon10/modules/auth/login'
export const DEFAULT_LOGOUT_PATH = '/__kon10/modules/auth/logout'
export const DEFAULT_CURRENT_USER_PATH = '/__kon10/modules/auth/current-user'

/**
 * Where the public content delivery API is mounted — the read-only REST
 * surface headless consumers fetch, as opposed to the Studio-gated RPC above.
 * Versioned so the envelope/query semantics can evolve as `/api/v2` alongside
 * a still-working v1; the segment must stay in sync with the route literal in
 * `@kon10/start`'s `routes/api.ts`.
 */
export const DEFAULT_API_PATH = '/api/v1'

/** Identity validator that pins a custom server function's input to `Kon10RpcInput`. */
export function kon10RpcValidator(data: Kon10RpcInput): Kon10RpcInput {
  return data
}
