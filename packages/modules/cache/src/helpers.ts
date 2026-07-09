/**
 * Generic cache-or-compute utilities for any module that wants to read
 * through `latha.cache` without reimplementing the get/miss/set dance.
 * Fully generic — no knowledge of what's being cached, unlike the
 * delivery-API cache in `@latha/start`, which has its own inline logic
 * (it also has to attach CORS headers on every path, so this helper
 * doesn't fit it cleanly).
 */
import type { JsonValue, LathaInstance } from '@latha/core'

/**
 * Read `key` from `latha.cache` if one is registered; otherwise always
 * recompute. On a miss, `compute()` is called and a non-null result is
 * cached for `ttlSeconds`.
 */
export async function cached<T>(
  latha: LathaInstance,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T | null>,
): Promise<T | null> {
  const cache = latha.cache
  if (!cache) return compute()
  const hit = await cache.get(key)
  if (hit !== undefined) return hit as T
  const value = await compute()
  // T is intentionally unconstrained (callers cache plain DB records, not
  // just JsonValue-shaped data) — cast at the one point that matters, same
  // as the delivery-API cache does for its response bodies.
  if (value !== null) await cache.set(key, value as unknown as JsonValue, ttlSeconds)
  return value
}

/** No-op when no cache is registered — same optional-adapter contract as `cached`. */
export async function invalidate(latha: LathaInstance, key: string): Promise<void> {
  await latha.cache?.delete(key)
}
