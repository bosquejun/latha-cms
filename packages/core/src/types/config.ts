/**
 * Top-level configuration and module/plugin contracts.
 */

import type { DBAdapter, StorageAdapter } from './adapter.js'
import type { AnyEntity } from './entity.js'
import type { Guard } from './guard.js'
import type { FieldTypeEntry } from '../fields/registry.js'

/** Forward reference to the live instance; defined in `bootstrap`. */
export interface LathaInstance {
  config: ResolvedConfig
  db: DBAdapter
  /** Optional blob/file storage adapter — set when a module (e.g. `@latha/media`) needs one. */
  storage?: StorageAdapter
  /** Flat list of every entity contributed by every module. */
  entities: AnyEntity[]
  /** Resolve a single entity by slug. */
  getEntity(slug: string): AnyEntity | undefined
  /** Modules in resolved (topologically sorted) order. */
  modules: Module[]
  /**
   * Registered authorization guards, run for every operation after an
   * entity's own `access` predicate. The kernel never interprets them.
   */
  guards: Guard[]
  /** Register an authorization guard (typically from a module's `onInit`). */
  registerGuard(guard: Guard): void
  /** Register a field type with the field registry (typically from a module's `onInit`). */
  registerFieldType(entry: FieldTypeEntry): void
  /**
   * Register the blob/file storage adapter (typically from a module's
   * `onInit`, e.g. `@latha/media`). Core has no opinion on storage — this is
   * a generic extension seam, the same shape as `registerGuard`/
   * `registerFieldType`, not a config concept core itself needs.
   */
  registerStorageAdapter(adapter: StorageAdapter): void
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
  /**
   * Sidebar this module's entities belong to: the main nav (default) or the
   * `settings` area. An entity's own `admin.area` overrides this.
   */
  area?: 'main' | 'settings'
  /** Section heading. Defaults to a humanized module name (`content` → Content). */
  label?: string
  /** Section sort order (lower first). Defaults to the module's resolution order. */
  order?: number
  /** Render the section as a collapsible group. Default false (flat heading). */
  collapsible?: boolean
  /** Start a collapsible section collapsed. Default false (open). */
  defaultCollapsed?: boolean
}

export interface ModuleAdminConfig {
  /** Default sidebar section for this module's entities. */
  nav?: ModuleNavConfig
  /**
   * Bare import specifier for this module's admin-UI barrel (e.g.
   * '@latha/auth/admin'). The Start Vite plugin statically imports and merges
   * it into the admin extension registry at build time. A serializable string —
   * never a component. Omit for backend-only modules.
   */
  ui?: string
}

export interface Module {
  name: string
  dependsOn?: string[]
  onInit?: (cms: LathaInstance) => void | Promise<void>
  onReady?: (cms: LathaInstance) => void | Promise<void>
  routes?: ModuleRoutes
  entities?: AnyEntity[]
  capabilities?: string[]
  adminPages?: AdminPage[]
  /** Admin-UI metadata for this module (sidebar grouping). */
  admin?: ModuleAdminConfig
}

export interface PluginAdminConfig {
  /**
   * Bare import specifier for this plugin's admin-UI barrel (e.g.
   * '@latha/slug/admin'). Same contract as `ModuleAdminConfig.ui`: the Start
   * Vite plugin statically imports and merges it into the admin extension
   * registry at build time. A serializable string — never a component. Omit
   * for backend-only plugins.
   */
  ui?: string
}

export interface Plugin {
  name: string
  extendConfig?: (config: LathaConfig) => LathaConfig
  onInit?: (cms: LathaInstance) => void | Promise<void>
  /** Admin-UI metadata for this plugin (extension barrel). */
  admin?: PluginAdminConfig
}

/**
 * Public delivery-API settings. A passthrough for runners (e.g. `@latha/start`
 * mounts the read-only REST surface and applies these) — the kernel itself
 * never reads them, the same contract as `adminPath`.
 */
export interface DeliveryApiConfig {
  /**
   * CORS origins allowed on delivery-API responses: `'*'` (the default —
   * public content is meant to be fetched cross-origin), an explicit origin
   * list, or `false` to send no CORS headers at all.
   */
  cors?: '*' | string[] | false
}

export interface LathaConfig {
  db: DBAdapter
  modules: Module[]
  plugins?: Plugin[]
  /** Base path the admin UI is mounted under. Defaults to `/admin`. */
  adminPath?: string
  /** Public delivery-API settings, read by runners — see {@link DeliveryApiConfig}. */
  api?: DeliveryApiConfig
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
