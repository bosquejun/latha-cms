/**
 * `defineConfig()` and the CMS bootstrap.
 *
 * `defineConfig()` is the entry point referenced from `cms.config.ts`. It
 * applies defaults and plugin `extendConfig` transforms and returns a
 * `ResolvedConfig`. `bootstrapKon10()` turns that config into a live
 * `Kon10Instance`: it builds the module registry, resolves dependency order,
 * runs `onInit` → `migrate` → `onReady`, and exposes entity lookups.
 */

import '../fields/builtins.js'
import { fieldRegistry } from '../fields/registry.js'
import type { FieldTypeEntry } from '../fields/registry.js'
import { ModuleRegistry } from '../registry/index.js'
import type { CacheAdapter, StorageAdapter } from '../types/adapter.js'
import type { Entity } from '../types/entity.js'
import type { Guard } from '../types/guard.js'
import type {
  Kon10Instance,
  Module,
  Kon10Config,
  ResolvedConfig,
} from '../types/config.js'

const DEFAULT_ADMIN_PATH = '/admin'

/**
 * Normalize a user config: apply defaults and run plugin `extendConfig`
 * transforms in declaration order.
 */
export function defineConfig(config: Kon10Config): ResolvedConfig {
  const plugins = config.plugins ?? []

  let working: Kon10Config = config
  for (const plugin of plugins) {
    if (plugin.extendConfig) working = plugin.extendConfig(working)
  }

  return {
    ...working,
    plugins,
    adminPath: working.adminPath ?? DEFAULT_ADMIN_PATH,
  }
}

class Kon10 implements Kon10Instance {
  readonly config: ResolvedConfig
  readonly db: ResolvedConfig['db']
  storage?: StorageAdapter
  cache?: CacheAdapter
  modules: Module[] = []
  entities: Entity[] = []
  guards: Guard[] = []
  ready = false

  private readonly registry = new ModuleRegistry()
  private readonly entityIndex = new Map<string, Entity>()

  constructor(config: ResolvedConfig) {
    this.config = config
    this.db = config.db
  }

  getEntity(slug: string): Entity | undefined {
    return this.entityIndex.get(slug)
  }

  registerGuard(guard: Guard): void {
    this.guards.push(guard)
  }

  registerFieldType(entry: FieldTypeEntry): void {
    fieldRegistry.register(entry)
  }

  registerStorageAdapter(adapter: StorageAdapter): void {
    this.storage = adapter
  }

  registerCacheAdapter(adapter: CacheAdapter): void {
    this.cache = adapter
  }

  async boot(): Promise<this> {
    this.registry.registerAll(this.config.modules)
    this.modules = this.registry.resolve()

    this.entities = this.registry.collectEntities()
    for (const entity of this.entities) this.entityIndex.set(entity.slug, entity)

    await this.db.connect?.()

    for (const module of this.modules) await module.onInit?.(this)

    for (const plugin of this.config.plugins) await plugin.onInit?.(this)

    await this.db.migrate(this.entities)

    for (const module of this.modules) await module.onReady?.(this)

    this.ready = true
    return this
  }
}

/** Build and initialize a `Kon10Instance` from a resolved config. */
export async function bootstrapKon10(
  config: ResolvedConfig,
): Promise<Kon10Instance> {
  const kon10 = new Kon10(config)
  return kon10.boot()
}
