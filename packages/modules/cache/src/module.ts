import type { CacheAdapter, LathaInstance, Module } from '@latha/core'

export interface CacheModuleConfig {
  /** The cache adapter to register (e.g. `inMemoryCache()`, `redisCache({ url })`). */
  cache: CacheAdapter
}

/**
 * Registers a `CacheAdapter` onto `latha.cache`. The delivery API
 * (`@latha/start`) reads through it automatically, honoring
 * `DeliveryApiConfig.cache` and each entity's `api.cache` override. Modules
 * needing bespoke caching outside that path can also reach `cms.cache`
 * directly from a `ModuleRoute` handler, the same way `@latha/media`'s
 * upload route reads `cms.storage`.
 */
export function CacheModule(config: CacheModuleConfig): Module {
  return {
    name: 'cache',
    onInit(cms: LathaInstance) {
      cms.registerCacheAdapter(config.cache)
    },
  }
}
