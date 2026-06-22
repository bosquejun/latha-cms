/**
 * @latha/start — the TanStack Start integration for LathaCMS.
 *
 * The consuming app writes a `latha.config.ts` and wires one server function;
 * this package provides the typed client, the React provider, and the entire
 * admin + login UI. The server dispatcher lives at `@latha/start/server` (kept
 * separate so its server-only imports never reach the client bundle).
 */

export { createLathaClient, type LathaClient } from './client.js'
export { lathaRpcValidator } from './default-rpc.js'
export {
  LathaProvider,
  useLatha,
  type LathaProviderProps,
  type LathaContextValue,
} from './context.js'
export { LathaAdmin } from './admin.js'
export { LathaLogin } from './login.js'

export type {
  LathaRpcInput,
  LathaServerFn,
  JsonDoc,
  SessionUser,
  NavItem,
  EntityDescriptor,
} from './rpc.js'
