/**
 * Top-level configuration and module/plugin contracts.
 */

import type { AuthAdapter, DBAdapter } from './adapter.js'
import type { Entity } from './collection.js'

/** Forward reference to the live instance; defined in `bootstrap`. */
export interface LathaInstance {
  config: ResolvedConfig
  db: DBAdapter
  /**
   * The active auth adapter, or `null` when no AuthModule is installed.
   * AuthModule sets this during `onInit`.
   */
  auth: AuthAdapter | null
  /** Flat list of every entity contributed by every module. */
  entities: Entity[]
  /** Resolve a single entity by slug. */
  getEntity(slug: string): Entity | undefined
  /** Modules in resolved (topologically sorted) order. */
  modules: Module[]
  ready: boolean
}

export interface ModuleRoutes {
  [path: string]: unknown
}

export interface AdminPage {
  path: string
  label: string
  group?: string
}

/** How a module's entities are grouped into a sidebar section by default. */
export interface ModuleNavConfig {
  /** Section heading. Omit to leave the entities ungrouped (no heading). */
  label?: string
  /** Section sort order (lower first). Defaults to the module's resolution order. */
  order?: number
  /**
   * Icon name for the section (accordion parent row / collapsed flyout). Resolved
   * to a component by the admin UI, e.g. `'layers'`, `'settings'`, `'folder'`.
   */
  icon?: string
  /** Render the section as a collapsible accordion group. Default false (heading). */
  collapsible?: boolean
  /** Start a collapsible section collapsed. Default false (open). */
  defaultCollapsed?: boolean
}

export interface ModuleAdminConfig {
  /** Default sidebar section for this module's entities. */
  nav?: ModuleNavConfig
}

export interface Module {
  name: string
  dependsOn?: string[]
  onInit?: (cms: LathaInstance) => void | Promise<void>
  onReady?: (cms: LathaInstance) => void | Promise<void>
  routes?: ModuleRoutes
  entities?: Entity[]
  capabilities?: string[]
  adminPages?: AdminPage[]
  /** Admin-UI metadata for this module (sidebar grouping). */
  admin?: ModuleAdminConfig
}

export interface Plugin {
  name: string
  extendConfig?: (config: LathaConfig) => LathaConfig
  onInit?: (cms: LathaInstance) => void | Promise<void>
}

export interface LathaConfig {
  db: DBAdapter
  modules: Module[]
  plugins?: Plugin[]
  /** Base path the admin UI is mounted under. Defaults to `/admin`. */
  adminPath?: string
  /**
   * Optional one-time setup run once after the instance is ready (e.g. seeding
   * a first admin user). Runners decide when to invoke it; the kernel does not.
   */
  seed?: (latha: LathaInstance) => void | Promise<void>
}

/** Config after `defineConfig()` has applied defaults and plugin transforms. */
export interface ResolvedConfig extends LathaConfig {
  adminPath: string
  plugins: Plugin[]
}
