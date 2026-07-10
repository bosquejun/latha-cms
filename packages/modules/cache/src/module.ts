import type { CacheAdapter, Kon10Instance, Module } from '@kon10/core'

export interface CacheModuleConfig {
  /** The cache adapter to register (e.g. `inMemoryCache()`, `redisCache({ url })`). */
  cache: CacheAdapter
}

/**
 * Registers a `CacheAdapter` onto `kon10.cache`. The delivery API
 * (`@kon10/start`) reads through it automatically, honoring
 * `DeliveryApiConfig.cache` and each entity's `api.cache` override. Modules
 * needing bespoke caching outside that path can also reach `cms.cache`
 * directly from a `ModuleRoute` handler, the same way `@kon10/media`'s
 * upload route reads `cms.storage`.
 */
export function CacheModule(config: CacheModuleConfig): Module {
  return {
    name: 'cache',
    onInit(cms: Kon10Instance) {
      cms.registerCacheAdapter(config.cache)
    },
  }
}
