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
} from '@latha/admin-sdk'
export { lathaRpcValidator, DEFAULT_RPC_PATH } from '@latha/admin-sdk'
export {
  LathaProvider,
  useLatha,
  type LathaProviderProps,
  type LathaContextValue,
} from '@latha/admin-sdk'
export { LathaAdmin } from './admin.js'
export { LathaLogin } from './login.js'
export { useAsync, type AsyncState } from '@latha/admin-sdk'

// Admin extension authoring surface — re-exported so apps import from one place.
export {
  ADMIN_ZONES,
  isAdminZone,
  defineAdminExtensions,
  defineWidgetConfig,
  definePageConfig,
  defineDashboardWidgetConfig,
  defineSettingsConfig,
  defineFieldConfig,
  Slot,
  useExtensions,
  useZoneWidgets,
  registerFieldRenderer,
  type AdminZone,
  type WidgetContext,
  type AdminExtensions,
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
  type NavItemExtension,
  type ExtensionRegistry,
  type FieldControlProps,
  type FieldRenderer,
} from '@latha/admin-sdk'

export type {
  LathaRpcInput,
  LathaServerFn,
  JsonDoc,
  SessionUser,
  NavItem,
  EntityDescriptor,
} from '@latha/admin-sdk'
