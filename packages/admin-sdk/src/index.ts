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
export { Sidebar, type SidebarProps, type SidebarLinkProps } from './shell/Sidebar.js'
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
