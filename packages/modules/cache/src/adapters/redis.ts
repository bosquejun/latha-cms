/**
 * Redis-backed `CacheAdapter`. Values are JSON-serialized on write and parsed
 * on read, so any `JsonValue` can be stored regardless of what Redis itself
 * natively supports (strings).
 *
 * Pass `url` for the common case (`new Redis(url)` under the hood). Pass a
 * pre-constructed `client` instead when you need Cluster/Sentinel, custom
 * TLS, or connection reuse across adapters — and it's what tests inject a
 * fake client through, since `RedisClientLike` only requires the four
 * methods this adapter actually calls.
 */
import { Redis } from 'ioredis'
import type { CacheAdapter, JsonValue } from '@kon10/core'

/** The subset of the `ioredis` client this adapter needs. A real `Redis` instance satisfies it. */
export interface RedisClientLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<string | null>
  set(key: string, value: string): Promise<string | null>
  del(key: string): Promise<number>
  exists(key: string): Promise<number>
}

export interface RedisCacheOptions {
  /** Redis connection string, e.g. `redis://user:pass@host:6379`. Ignored if `client` is given. */
  url?: string
  /** Prefix applied to every key — useful when multiple apps share one Redis instance. */
  keyPrefix?: string
  /** Pre-constructed client, taking precedence over `url`. See module docs above. */
  client?: RedisClientLike
}

export function redisCache(options: RedisCacheOptions = {}): CacheAdapter {
  const client: RedisClientLike = options.client ?? new Redis(options.url ?? 'redis://localhost:6379')
  const prefixed = (key: string) => (options.keyPrefix ? `${options.keyPrefix}${key}` : key)

  return {
    async get(key: string) {
      const raw = await client.get(prefixed(key))
      return raw === null ? undefined : (JSON.parse(raw) as JsonValue)
    },
    async set(key: string, value: JsonValue, ttlSeconds?: number) {
      const raw = JSON.stringify(value)
      if (ttlSeconds !== undefined) {
        await client.set(prefixed(key), raw, 'EX', ttlSeconds)
      } else {
        await client.set(prefixed(key), raw)
      }
    },
    async delete(key: string) {
      await client.del(prefixed(key))
    },
    async has(key: string) {
      return (await client.exists(prefixed(key))) === 1
    },
  }
}
