/**
 * @latha/cache — CacheAdapter implementations.
 *
 * `inMemoryCache()` is single-process only (dev, tests, or a single-instance
 * deploy); `redisCache()` is the shared-cache option for anything running
 * more than one instance.
 */

export { inMemoryCache } from './adapters/in-memory.js'
export {
  redisCache,
  type RedisCacheOptions,
  type RedisClientLike,
} from './adapters/redis.js'
export { CacheModule, type CacheModuleConfig } from './module.js'
export { cached, invalidate } from './helpers.js'
