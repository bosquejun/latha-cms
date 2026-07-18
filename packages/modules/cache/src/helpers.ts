/**
 * Generic cache-or-compute utilities for any module that wants to read
 * through `kon10.cache` without reimplementing the get/miss/set dance.
 * Fully generic — no knowledge of what's being cached, unlike the
 * delivery-API cache in `@kon10/start`, which has its own inline logic
 * (it also has to attach CORS headers on every path, so this helper
 * doesn't fit it cleanly).
 */
import type { JsonValue, Kon10Instance } from 'kon10'

/**
 * Read `key` from `kon10.cache` if one is registered; otherwise always
 * recompute. On a miss, `compute()` is called and a non-null result is
 * cached for `ttlSeconds`.
 */
export async function cached<T>(
  kon10: Kon10Instance,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T | null>,
): Promise<T | null> {
  const cache = kon10.cache
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
export async function invalidate(kon10: Kon10Instance, key: string): Promise<void> {
  await kon10.cache?.delete(key)
}
