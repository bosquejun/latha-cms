/**
 * The Latha client surface — the typed RPC client, the React provider/hooks,
 * and the client-safe RPC contract types. Moved here from `@latha/start` so
 * both `@latha/start` and `@latha/auth/admin` can consume it without a cycle.
 */

export { createLathaClient, type LathaClient, type LathaClientOptions } from './client.js'
export { lathaRpcValidator, DEFAULT_RPC_PATH } from './default-rpc.js'
export {
  LathaProvider,
  useLatha,
  PermissionsProvider,
  useCan,
  type LathaProviderProps,
  type LathaContextValue,
} from './context.js'
export { useAsync, type AsyncState } from './hooks.js'
export type {
  LathaRpcInput,
  LathaServerFn,
  JsonDoc,
  SessionUser,
  NavItem,
  NavSection,
  EntityDescriptor,
} from './rpc.js'
