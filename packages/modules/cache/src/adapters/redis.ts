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
import type { CacheAdapter, JsonValue } from 'kon10'

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
  const client: RedisClientLike = options.client ?? createDefaultClient(options.url)
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

/**
 * Constructs the default `ioredis` client for the `url`-based path.
 *
 * `lazyConnect: true` is load-bearing: without it, `new Redis(url)` opens the
 * TCP connection the instant the client is constructed — so merely importing a
 * config that calls `redisCache()` dials Redis. During a build (e.g. Vercel
 * evaluating `kon10.config.*.ts`) there is no Redis to reach and the env var
 * often isn't populated yet, so that eager dial surfaces as
 * `ECONNREFUSED 127.0.0.1:6379` (the localhost fallback). Deferring the
 * connection keeps construction side-effect-free; it opens on the first
 * delivery-API read at runtime instead.
 *
 * The `error` listener is equally load-bearing: an `ioredis` client is an
 * `EventEmitter`, and an `'error'` event with no listener is re-thrown by Node
 * as an unhandled exception ("Unhandled error event"). Listening keeps
 * transient connection errors from crashing the process — ioredis reconnects
 * on its own.
 */
function createDefaultClient(url?: string): RedisClientLike {
  const client = new Redis(url ?? 'redis://localhost:6379', { lazyConnect: true })
  client.on('error', (err: Error) => {
    console.error('[kon10:cache] redis client error:', err.message)
  })
  return client
}
