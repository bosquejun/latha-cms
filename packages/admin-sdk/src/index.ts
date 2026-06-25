/**
 * @latha/admin-sdk — the CMS-aware admin layer.
 *
 * Builds on `@latha/ui` (design system) and `@latha/core` (kernel). Provides
 * the admin shell, the registry-driven sidebar, the field renderer registry,
 * and the auto-generated collection/document views. It owns no data fetching or
 * routing — the app wires those in and passes data + callbacks down.
 */

// Registry-driven description (pure, serializable)
export {
  describeEntity,
  describeEntities,
  buildNav,
  hrefFor,
  humanize,
  type AdminEntity,
  type AdminNavItem,
  type EntityKind,
} from './schema.js'

// Shell
export { AdminShell, type AdminShellProps } from './shell/AdminShell.js'
export {
  Sidebar,
  type SidebarProps,
  type SidebarLinkProps,
  type SidebarSection,
  type SidebarItem,
} from './shell/Sidebar.js'
export { MobileDrawer, type MobileDrawerProps } from './shell/MobileDrawer.js'
export { Topbar, type TopbarProps } from './shell/Topbar.js'
export { useTheme, type Theme } from './shell/useTheme.js'
export { UserMenu, type UserMenuProps } from './shell/UserMenu.js'
export { PageHeader, type PageHeaderProps } from './shell/PageHeader.js'
export { EmptyState, type EmptyStateProps } from './shell/EmptyState.js'

// Field renderers
export {
  getFieldRenderer,
  registerFieldRenderer,
  type FieldRenderer,
  type FieldControlProps,
} from './fields/registry.js'

// Extension system — injection zones, registry, <Slot>, define* helpers
export {
  ADMIN_ZONES,
  isAdminZone,
  type AdminZone,
  type WidgetContext,
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
  createExtensionRegistry,
  EMPTY_REGISTRY,
  type ExtensionRegistry,
  ExtensionsProvider,
  useExtensions,
  useZoneWidgets,
  type ExtensionsProviderProps,
  Slot,
  type SlotProps,
  collectAdminExtensions,
  mergeExtensions,
  type GlobMap,
  type AdminGlobs,
} from './extensions/index.js'

// Client surface — typed RPC client, React provider/hooks, RPC contract types
export * from './client/index.js'

// Views
export {
  CollectionList,
  type CollectionListProps,
  type CollectionRow,
} from './views/CollectionList.js'
export {
  CollectionForm,
  type CollectionFormProps,
} from './views/CollectionForm.js'
export { DocumentForm, type DocumentFormProps } from './views/DocumentForm.js'
export { EntityForm, type EntityFormProps } from './views/EntityForm.js'
