/**
 * `defineConfig()` and the CMS bootstrap.
 *
 * `defineConfig()` is the entry point referenced from `cms.config.ts`. It
 * applies defaults and plugin `extendConfig` transforms and returns a
 * `ResolvedConfig`. `bootstrapCMS()` turns that config into a live
 * `CMSInstance`: it builds the module registry, resolves dependency order,
 * runs `onInit` → `migrate` → `onReady`, and exposes entity lookups.
 */

import { ModuleRegistry } from '../registry/index.js'
import { isCollection } from '../types/collection.js'
import type { Entity } from '../types/collection.js'
import type {
  CMSInstance,
  CMSModule,
  LathaConfig,
  ResolvedConfig,
} from '../types/config.js'

const DEFAULT_ADMIN_PATH = '/admin'

/**
 * Normalize a user config: apply defaults and run plugin `extendConfig`
 * transforms in declaration order.
 */
export function defineConfig(config: LathaConfig): ResolvedConfig {
  const plugins = config.plugins ?? []

  let working: LathaConfig = config
  for (const plugin of plugins) {
    if (plugin.extendConfig) working = plugin.extendConfig(working)
  }

  return {
    ...working,
    plugins,
    adminPath: working.adminPath ?? DEFAULT_ADMIN_PATH,
  }
}

class Cms implements CMSInstance {
  readonly config: ResolvedConfig
  readonly db: ResolvedConfig['db']
  modules: CMSModule[] = []
  entities: Entity[] = []
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

  async boot(): Promise<this> {
    // 1. Register + resolve module order.
    this.registry.registerAll(this.config.modules)
    this.modules = this.registry.resolve()

    // 2. Collect entities and index them by slug.
    this.entities = this.registry.collectEntities()
    for (const entity of this.entities) this.entityIndex.set(entity.slug, entity)

    // 3. Connect the database.
    await this.db.connect?.()

    // 4. onInit (resolved order).
    for (const module of this.modules) await module.onInit?.(this)

    // 5. Plugin onInit.
    for (const plugin of this.config.plugins) await plugin.onInit?.(this)

    // 6. Migrate schema for all collection entities.
    const collections = this.entities.filter(isCollection)
    await this.db.migrate(collections)

    // 7. onReady (resolved order).
    for (const module of this.modules) await module.onReady?.(this)

    this.ready = true
    return this
  }
}

/** Build and initialize a `CMSInstance` from a resolved config. */
export async function bootstrapCMS(
  config: ResolvedConfig,
): Promise<CMSInstance> {
  const cms = new Cms(config)
  return cms.boot()
}
