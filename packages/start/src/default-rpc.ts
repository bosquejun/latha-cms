/**
 * Client-safe helper for the app's single RPC endpoint.
 *
 * TanStack Start compiles the `createServerFn` boundary out of *app* code (it
 * splits the handler off the client bundle by file), so the `createServerFn`
 * call itself has to live in the consuming app — a pre-built server function
 * shipped from this package would never get that split and would drag the
 * server-only dispatcher into the browser bundle.
 *
 * What the app can offload is the boilerplate: this validator (client-safe) and
 * `dispatchLathaRpc` from `@latha/start/server` (pulled in lazily inside the
 * handler so its cookie/db imports never reach the client). The endpoint then
 * shrinks to a few lines — see `apps/playground/src/latha-client.ts`.
 */

import type { LathaRpcInput } from './rpc.js'

/** Identity validator that pins the server function's input to `LathaRpcInput`. */
export function lathaRpcValidator(data: LathaRpcInput): LathaRpcInput {
  return data
}
