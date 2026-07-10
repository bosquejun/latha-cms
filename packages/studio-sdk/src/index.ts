/**
 * @kon10/studio-sdk — the CMS-aware Studio layer.
 *
 * Builds on `@kon10/ui` (design system) and `@kon10/core` (kernel). Provides
 * the Studio shell, the registry-driven sidebar, the field renderer registry,
 * and the auto-generated collection/document views. It owns no data fetching or
 * routing — the app wires those in and passes data + callbacks down.
 */

// Registry-driven description (pure, serializable)
export {
  describeEntity,
  describeEntities,
  humanize,
  type StudioEntity,
  type EntityKind,
} from './schema.js'

// Shell
export { StudioShell, type StudioShellProps } from './shell/StudioShell.js'
export {
  Sidebar,
  type SidebarProps,
  type SidebarLinkProps,
  type SidebarSection,
  type SidebarItem,
  type SidebarIcon,
} from './shell/Sidebar.js'
export { MobileDrawer, type MobileDrawerProps } from './shell/MobileDrawer.js'
export { Topbar, type TopbarProps } from './shell/Topbar.js'
export { useTheme, type Theme } from './shell/useTheme.js'
export { PageHeader, type PageHeaderProps } from './shell/PageHeader.js'
export { EmptyState, type EmptyStateProps } from './shell/EmptyState.js'
export { LoadingState, type LoadingStateProps } from './shell/LoadingState.js'
export { PageLayout, type PageLayoutProps } from './shell/PageLayout.js'
export { WidgetLayout, type WidgetLayoutProps } from './shell/WidgetLayout.js'

// Field renderers
export {
  getFieldRenderer,
  registerFieldRenderer,
  type FieldRenderer,
  type FieldControlProps,
} from './fields/registry.js'

// Client-side form validation schema (registry schema + jsonSchema mirrors)
export { buildFormSchema, zodFromJsonSchema } from './fields/formSchema.js'

// Sibling-field form state for renderers (e.g. a slug input following title)
export {
  FormValuesProvider,
  useFieldValue,
  type FormValuesStore,
} from './fields/form-values.js'

// Extension system — injection zones, registry, <Slot>, define* helpers
export {
  STUDIO_ZONES,
  isStudioZone,
  type StudioZone,
  type WidgetContext,
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
  createExtensionRegistry,
  EMPTY_REGISTRY,
  type ExtensionRegistry,
  ExtensionsProvider,
  useExtensions,
  useZoneWidgets,
  type ExtensionsProviderProps,
  Slot,
  type SlotProps,
  collectStudioExtensions,
  mergeExtensions,
  type GlobMap,
  type StudioGlobs,
} from './extensions/index.js'

// Client surface — typed RPC client, React provider/hooks, RPC contract types
export * from './client/index.js'

// Lexical extensibility — register global nodes/plugins/theme for richtext fields
export {
  registerLexicalExtension,
  type LexicalExtension,
} from './fields/renderers/lexical/registry.js'

// Views
export {
  EntityList,
  type EntityListProps,
  type EntityRow,
} from './views/EntityList.js'
export { EntityForm, type EntityFormProps } from './views/EntityForm.js'
