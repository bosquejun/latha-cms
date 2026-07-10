/**
 * The Studio extension system — injection zones, the registry, the `<Slot>`
 * primitive, and the `define*` authoring helpers.
 */

export {
  STUDIO_ZONES,
  isStudioZone,
  type StudioZone,
  type WidgetContext,
} from './zones.js'

export {
  defineStudioExtensions,
  defineWidgetConfig,
  definePageConfig,
  defineDashboardWidgetConfig,
  defineSettingsConfig,
  defineFieldConfig,
  defineEntityListConfig,
  type StudioExtensions,
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
  type EntityListComponent,
  type EntityListConfig,
  type EntityListRendererExtension,
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

export {
  collectStudioExtensions,
  mergeExtensions,
  type GlobMap,
  type StudioGlobs,
} from './collect.js'
