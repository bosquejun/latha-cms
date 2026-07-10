/**
 * The Kon10 client surface — the typed RPC client, the React provider/hooks,
 * and the client-safe RPC contract types, so both `@kon10/start` and
 * `@kon10/auth/studio` can consume it without a dependency cycle.
 */

export { createKon10Client, type Kon10Client, type Kon10ClientOptions } from './client.js'
export {
  kon10RpcValidator,
  DEFAULT_RPC_PATH,
  DEFAULT_UPLOAD_PATH,
  DEFAULT_LOGIN_PATH,
  DEFAULT_LOGOUT_PATH,
  DEFAULT_CURRENT_USER_PATH,
  DEFAULT_API_PATH,
} from './default-rpc.js'
export {
  Kon10Provider,
  useKon10,
  PermissionsProvider,
  useCan,
  StudioNavigateProvider,
  useStudioNavigate,
  type Kon10ProviderProps,
  type Kon10ContextValue,
} from './context.js'
export { useAsync, type AsyncState } from './hooks.js'
export {
  Kon10RpcInputSchema,
  type Kon10RpcInput,
  type Kon10ServerFn,
  type JsonDoc,
  type PageResult,
  type SessionUser,
  type NavItem,
  type NavSection,
  type EntityDescriptor,
} from './rpc.js'
