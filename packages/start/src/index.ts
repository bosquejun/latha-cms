/**
 * @latha/start — the TanStack Start integration for LathaCMS.
 *
 * The consuming app writes a `latha.config.ts` and mounts `<LathaProvider>`;
 * this package provides the typed client, the React provider, the entire admin
 * + login UI, and the RPC endpoint itself (a server route injected by
 * `lathaStart()`). No hand-written server function required — `createLathaClient()`
 * talks to that route out of the box. The server dispatcher lives at
 * `@latha/start/server` (kept separate so its server-only imports never reach the
 * client bundle).
 */

export {
  createLathaClient,
  type LathaClient,
  type LathaClientOptions,
} from './client.js'
export { lathaRpcValidator, DEFAULT_RPC_PATH } from './default-rpc.js'
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
