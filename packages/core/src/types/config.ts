/**
 * Top-level configuration and module/plugin contracts.
 */

import type { DBAdapter } from './adapter.js'
import type { Entity } from './collection.js'

/** Forward reference to the live instance; defined in `bootstrap`. */
export interface CMSInstance {
  config: ResolvedConfig
  db: DBAdapter
  /** Flat list of every entity contributed by every module. */
  entities: Entity[]
  /** Resolve a single entity by slug. */
  getEntity(slug: string): Entity | undefined
  /** Modules in resolved (topologically sorted) order. */
  modules: CMSModule[]
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

export interface CMSModule {
  name: string
  dependsOn?: string[]
  onInit?: (cms: CMSInstance) => void | Promise<void>
  onReady?: (cms: CMSInstance) => void | Promise<void>
  routes?: ModuleRoutes
  entities?: Entity[]
  capabilities?: string[]
  adminPages?: AdminPage[]
}

export interface CMSPlugin {
  name: string
  extendConfig?: (config: LathaConfig) => LathaConfig
  onInit?: (cms: CMSInstance) => void | Promise<void>
}

export interface LathaConfig {
  db: DBAdapter
  modules: CMSModule[]
  plugins?: CMSPlugin[]
  /** Base path the admin UI is mounted under. Defaults to `/admin`. */
  adminPath?: string
}

/** Config after `defineConfig()` has applied defaults and plugin transforms. */
export interface ResolvedConfig extends LathaConfig {
  adminPath: string
  plugins: CMSPlugin[]
}
