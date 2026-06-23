/**
 * @latha/start — the TanStack Start integration for LathaCMS.
 *
 * The consuming app writes a `latha.config.ts` and wires one server function;
 * this package provides the typed client, the React provider, and the entire
 * admin + login UI. The server dispatcher lives at `@latha/start/server` (kept
 * separate so its server-only imports never reach the client bundle).
 */

export { createLathaClient, type LathaClient } from './client.js'
export {
  LathaProvider,
  useLatha,
  type LathaProviderProps,
  type LathaContextValue,
} from './context.js'
export { LathaAdmin } from './admin.js'
export { LathaLogin } from './login.js'

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
} from './rpc.js'
