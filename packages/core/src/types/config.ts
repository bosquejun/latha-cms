/**
 * Top-level configuration and module/plugin contracts.
 */

import type { CacheAdapter, DBAdapter, StorageAdapter } from './adapter.js'
import type { AnyEntity, DeliveryCacheOption } from './entity.js'
import type { Guard } from './guard.js'
import type { FieldTypeEntry } from '../fields/registry.js'

/** Forward reference to the live instance; defined in `bootstrap`. */
export interface Kon10Instance {
  config: ResolvedConfig
  db: DBAdapter
  /** Optional blob/file storage adapter — set when a module (e.g. `@kon10/media`) needs one. */
  storage?: StorageAdapter
  /**
   * Optional key-value cache adapter — set when a module or the app itself
   * needs one (e.g. `@kon10/cache`'s `redisCache()`/`inMemoryCache()`). Core
   * has no opinion on what's cached; this is a generic extension seam.
   */
  cache?: CacheAdapter
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
   * `onInit`, e.g. `@kon10/media`). Core has no opinion on storage — this is
   * a generic extension seam, the same shape as `registerGuard`/
   * `registerFieldType`, not a config concept core itself needs.
   */
  registerStorageAdapter(adapter: StorageAdapter): void
  /**
   * Register the key-value cache adapter (typically from a module's
   * `onInit`, e.g. `@kon10/cache`). Same shape as `registerStorageAdapter` —
   * core never reads or writes through it itself.
   */
  registerCacheAdapter(adapter: CacheAdapter): void
  ready: boolean
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

/** Context a runner passes to a module route handler when it dispatches a request to it. */
export interface ModuleRouteContext {
  cms: Kon10Instance
  /**
   * The resolved caller for this request — an authenticated principal or the
   * runner's anonymous principal. Opaque to core, same contract as
   * `OperationContext.principal`.
   */
  principal: unknown
  request: Request
}

export interface ModuleRoute {
  method: HttpMethod
  /**
   * Gate this route behind the runner's Studio-access check before the handler
   * runs (the same gate the Studio RPC applies), so a module never needs to
   * import an auth package itself to enforce it. Default false — the handler
   * runs for any resolved principal (including the anonymous Public one) and
   * is responsible for its own authorization, e.g. via `operations.*`, which
   * already enforces entity access + guards.
   */
  requireStudioAccess?: boolean
  handler: (ctx: ModuleRouteContext) => Response | Promise<Response>
}

/**
 * A module's custom HTTP endpoints, keyed by path — relative to wherever the
 * runner mounts module routes (e.g. `@kon10/start` mounts them at
 * `/__kon10/modules/<module.name>/<path>`). One path may answer more than one
 * method.
 */
export interface ModuleRoutes {
  [path: string]: ModuleRoute | ModuleRoute[]
}

/** How a module's entities are grouped into a nav section by default. */
export interface ModuleNavConfig {
  /**
   * Nav area this module's entities belong to: the main nav (default) or the
   * `settings` area. An entity's own `studio.area` overrides this.
   */
  area?: 'main' | 'settings'
  /** Section heading. Defaults to a humanized module name (`content` → Content). */
  label?: string
  /** Section sort order (lower first). Defaults to the module's resolution order. */
  order?: number
  /**
   * Render this section's heading as a fold toggle where it appears as a
   * labelled group inside a section rail (e.g. a settings-area group in the
   * Settings tab's rail). Main-area sections become their own tab with a flat
   * rail, so the flag only takes effect where a group heading is rendered.
   */
  collapsible?: boolean
  /** Start a collapsible group folded (it still opens for the active page). */
  defaultCollapsed?: boolean
}

export interface ModuleStudioConfig {
  /** Default nav section for this module's entities. */
  nav?: ModuleNavConfig
  /** Width of this module's Studio rail + page container. Defaults to `default`. */
  contentWidth?: 'default' | 'full'
  /**
   * Bare import specifier for this module's Studio-UI barrel (e.g.
   * '@kon10/auth/studio'). The Start Vite plugin statically imports and merges
   * it into the Studio extension registry at build time. A serializable string —
   * never a component. Omit for backend-only modules.
   */
  ui?: string
}

/** How a module's entities are mounted in the public delivery API. */
export interface ModuleApiConfig {
  /**
   * Base path segment this module's entities are mounted under in the public
   * delivery API — `/api/v1/<prefix>/<entitySlug>[/<id>]` (or, when the
   * module contributes exactly one entity, `/api/v1/<prefix>[/<id>]` with no
   * redundant slug segment). Defaults to the module's own `name` if omitted.
   */
  prefix?: string
}

export interface Module {
  name: string
  dependsOn?: string[]
  onInit?: (cms: Kon10Instance) => void | Promise<void>
  onReady?: (cms: Kon10Instance) => void | Promise<void>
  /**
   * Custom HTTP endpoints this module exposes (e.g. `@kon10/media`'s file
   * upload route). The runner discovers and mounts these generically — it
   * never needs module-specific knowledge to dispatch them.
   */
  routes?: ModuleRoutes
  entities?: AnyEntity[]
  capabilities?: string[]
  /** Studio-UI metadata for this module (nav grouping, extension barrel). */
  studio?: ModuleStudioConfig
  /** Public delivery-API mounting config for this module's entities. */
  api?: ModuleApiConfig
}

/** This module's delivery-API prefix: its explicit `api.prefix`, or its `name`. */
export function moduleApiPrefix(module: Module): string {
  return module.api?.prefix ?? module.name
}

export interface PluginStudioConfig {
  /**
   * Bare import specifier for this plugin's Studio-UI barrel (e.g.
   * '@kon10/slug/studio'). Same contract as `ModuleStudioConfig.ui`: the Start
   * Vite plugin statically imports and merges it into the Studio extension
   * registry at build time. A serializable string — never a component. Omit
   * for backend-only plugins.
   */
  ui?: string
}

export interface Plugin {
  name: string
  extendConfig?: (config: Kon10Config) => Kon10Config
  onInit?: (cms: Kon10Instance) => void | Promise<void>
  /** Studio-UI metadata for this plugin (extension barrel). */
  studio?: PluginStudioConfig
}

/**
 * Public delivery-API settings. A passthrough for runners (e.g. `@kon10/start`
 * mounts the read-only REST surface and applies these) — the kernel itself
 * never reads them, the same contract as `studioPath`.
 */
export interface DeliveryApiConfig {
  /**
   * CORS origins allowed on delivery-API responses: `'*'` (the default —
   * public content is meant to be fetched cross-origin), an explicit origin
   * list, or `false` to send no CORS headers at all.
   */
  cors?: '*' | string[] | false
  /**
   * Read-through caching for delivery-API responses, backed by whichever
   * `CacheAdapter` a module registered onto `kon10.cache` (e.g.
   * `@kon10/cache`'s `CacheModule`). `ttlSeconds` defaults to 60. Pass
   * `false` to disable caching even when a cache adapter is registered —
   * omitting this caches whenever `kon10.cache` is set. Cached entries are
   * TTL-only: a write via the Studio RPC does not invalidate already-cached
   * delivery-API reads. Only successful (200) reads are cached. An entity's
   * own `api.cache` overrides this per entity.
   */
  cache?: DeliveryCacheOption
}

export interface Kon10Config {
  db: DBAdapter
  modules: Module[]
  plugins?: Plugin[]
  /** Base path the Studio UI is mounted under. Defaults to `/studio`. */
  studioPath?: string
  /** Public delivery-API settings, read by runners — see {@link DeliveryApiConfig}. */
  api?: DeliveryApiConfig
  /**
   * Optional one-time setup run once after the instance is ready (e.g. seeding
   * a first admin user). Runners decide when to invoke it; the kernel does not.
   */
  seed?: (kon10: Kon10Instance) => void | Promise<void>
}

/** Config after `defineConfig()` has applied defaults and plugin transforms. */
export interface ResolvedConfig extends Kon10Config {
  studioPath: string
  plugins: Plugin[]
}
