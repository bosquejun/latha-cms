# @kon10/cache — CacheAdapters

`CacheAdapter` implementations (`inMemoryCache`, `redisCache`) plus the `CacheModule` that registers one onto `kon10.cache`, and read-through helpers.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **Adapters** — `adapters/in-memory.ts` (`inMemoryCache`) and `adapters/redis.ts` (`redisCache`): implement core's `CacheAdapter` contract.
- **`CacheModule`** — `module.ts` (`CacheModule`, `CacheModuleConfig`): registers the chosen adapter onto the instance so runners' delivery-API read-through cache can use it.
- **Helpers** — `helpers.ts` (`cached`, `invalidate`): read-through wrapping and invalidation.

## Must never contain

- **Business logic.** A cache adapter never knows *what* is being cached — it stores keys and values with a TTL, nothing more. Never branch on entity kind, content shape, or auth state inside an adapter.

## Conventions specific to cache

- Adapters are pure key/value/TTL. Domain decisions (what to cache, when to invalidate) live at the call sites in runners/helpers, not in the adapter.
- Delivery-API caching is **TTL-only** by design: a Studio write does not invalidate already-cached delivery reads. Keep it that way unless the config contract changes.
- Both adapters satisfy the same `CacheAdapter` contract — keep parity between them.

## Tests

`adapters/{in-memory,redis}.test.ts`, `helpers.test.ts`, `module.test.ts` via `node:test` against `dist/`.
