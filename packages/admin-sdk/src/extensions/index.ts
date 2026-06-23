/**
 * The admin extension system — injection zones, the registry, the `<Slot>`
 * primitive, and the `define*` authoring helpers.
 */

export {
  ADMIN_ZONES,
  isAdminZone,
  type AdminZone,
  type WidgetContext,
} from './zones.js'

export {
  defineAdminExtensions,
  defineWidgetConfig,
  definePageConfig,
  defineDashboardWidgetConfig,
  defineSettingsConfig,
  defineFieldConfig,
  type AdminExtensions,
  type WidgetComponent,
  type WidgetConfig,
  type WidgetExtension,
  type PageComponentProps,
  type PageConfig,
  type PageExtension,
  type DashboardWidgetConfig,
  type DashboardWidgetExtension,
  type SettingsPageConfig,
  type SettingsPageExtension,
  type FieldRendererConfig,
  type FieldRendererExtension,
  type NavItemExtension,
} from './types.js'

export {
  createExtensionRegistry,
  EMPTY_REGISTRY,
  type ExtensionRegistry,
} from './registry.js'

export {
  ExtensionsProvider,
  useExtensions,
  useZoneWidgets,
  type ExtensionsProviderProps,
} from './context.js'

export { Slot, type SlotProps } from './Slot.js'
