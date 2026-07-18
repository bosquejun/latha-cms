/**
 * In-process `CacheAdapter` — a plain `Map` with lazy TTL expiry (checked on
 * read, no background sweep timer). Single-instance only: entries are not
 * shared across processes or dynos. Useful for local dev and tests, or as a
 * default when no external cache is configured; production deploys with more
 * than one instance should use `redisCache()` instead.
 */
import type { CacheAdapter, JsonValue } from 'kon10'

interface Entry {
  value: JsonValue
  expiresAt?: number
}

export function inMemoryCache(): CacheAdapter {
  const store = new Map<string, Entry>()

  function read(key: string): Entry | undefined {
    const entry = store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      store.delete(key)
      return undefined
    }
    return entry
  }

  return {
    async get(key: string) {
      return read(key)?.value
    },
    async set(key: string, value: JsonValue, ttlSeconds?: number) {
      store.set(key, {
        value,
        expiresAt: ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : undefined,
      })
    },
    async delete(key: string) {
      store.delete(key)
    },
    async has(key: string) {
      return read(key) !== undefined
    },
  }
}
