/**
 * @kon10/start — the TanStack Start integration for Kon10.
 *
 * The consuming app writes a `kon10.config.ts` and mounts `<Kon10Provider>`;
 * this package provides the typed client, the React provider, the entire Studio
 * + login UI, and the RPC endpoint itself (a server route injected by
 * `kon10Start()`). No hand-written server function required — `createKon10Client()`
 * talks to that route out of the box. The server dispatcher lives at
 * `@kon10/start/server` (kept separate so its server-only imports never reach the
 * client bundle).
 */

export {
  createKon10Client,
  type Kon10Client,
  type Kon10ClientOptions,
} from '@kon10/studio-sdk'
export {
  kon10RpcValidator,
  DEFAULT_RPC_PATH,
  DEFAULT_UPLOAD_PATH,
  DEFAULT_LOGIN_PATH,
  DEFAULT_LOGOUT_PATH,
  DEFAULT_CURRENT_USER_PATH,
} from '@kon10/studio-sdk'
export {
  Kon10Provider,
  useKon10,
  type Kon10ProviderProps,
  type Kon10ContextValue,
} from '@kon10/studio-sdk'
export { Kon10Studio } from './studio.js'
export { Kon10Login } from './login.js'
export { useAsync, type AsyncState } from '@kon10/studio-sdk'

// Studio extension authoring surface — re-exported so apps import from one place.
export {
  STUDIO_ZONES,
  isStudioZone,
  defineStudioExtensions,
  defineWidgetConfig,
  definePageConfig,
  defineDashboardWidgetConfig,
  defineSettingsConfig,
  defineFieldConfig,
  defineEntityListConfig,
  Slot,
  useExtensions,
  useZoneWidgets,
  registerFieldRenderer,
  type StudioZone,
  type WidgetContext,
  type StudioExtensions,
  type WidgetExtension,
  type WidgetConfig,
  type PageExtension,
  type PageConfig,
  type PageComponentProps,
  type DashboardWidgetExtension,
  type DashboardWidgetConfig,
  type SettingsPageExtension,
  type SettingsPageConfig,
  type FieldRendererExtension,
  type FieldRendererConfig,
  type EntityListComponent,
  type EntityListConfig,
  type EntityListRendererExtension,
  type EntityListProps,
  type NavItemExtension,
  type ExtensionRegistry,
  type FieldControlProps,
  type FieldRenderer,
} from '@kon10/studio-sdk'

export type {
  Kon10RpcInput,
  Kon10ServerFn,
  JsonDoc,
  SessionUser,
  NavItem,
  EntityDescriptor,
} from '@kon10/studio-sdk'

// Delivery-API response envelope — Zod-first, importable by any client that
// wants to validate/type a response fetched from `/api/v1/...`.
export {
  API_ERROR_CODES,
  apiErrorSchema,
  apiPaginationSchema,
  apiResponseSchema,
  apiSuccess,
  apiFailure,
  apiPaginationOf,
  type ApiErrorCode,
  type ApiError,
  type ApiPagination,
  type ApiResponse,
} from './envelope.js'
