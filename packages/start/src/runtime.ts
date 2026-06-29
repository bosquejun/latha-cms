/**
 * Server runtime — one bootstrapped, seeded `LathaInstance` per config.
 *
 * Memoized by config reference so repeated server-function calls in the same
 * process share a single instance (and run `config.seed` exactly once).
 */

import { bootstrapLatha, type LathaInstance, type ResolvedConfig } from '@latha/core'

// Avoid a hard @types/node dependency for env vars.
declare const process: { env: Record<string, string | undefined> }

const instances = new WeakMap<ResolvedConfig, Promise<LathaInstance>>()

async function boot(config: ResolvedConfig): Promise<LathaInstance> {
  if (process.env['NODE_ENV'] === 'production' && !process.env['AUTH_SECRET']) {
    throw new Error(
      '[latha] AUTH_SECRET environment variable is required in production. ' +
        'Set it to a cryptographically random string (32+ bytes).',
    )
  }
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
