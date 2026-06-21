/**
 * Server runtime — one bootstrapped, seeded `LathaInstance` per config.
 *
 * Memoized by config reference so repeated server-function calls in the same
 * process share a single instance (and run `config.seed` exactly once).
 */

import { bootstrapLatha, type LathaInstance, type ResolvedConfig } from '@latha/core'

const instances = new WeakMap<ResolvedConfig, Promise<LathaInstance>>()

async function boot(config: ResolvedConfig): Promise<LathaInstance> {
  const latha = await bootstrapLatha(config)
  if (config.seed) await config.seed(latha)
  return latha
}

/** Get (or lazily create) the running instance for a config. */
export function getRuntime(config: ResolvedConfig): Promise<LathaInstance> {
  let existing = instances.get(config)
  if (!existing) {
    existing = boot(config)
    instances.set(config, existing)
  }
  return existing
}
