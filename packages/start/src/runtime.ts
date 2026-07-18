/**
 * Server runtime — one bootstrapped, seeded `Kon10Instance` per config.
 *
 * Memoized by config reference so repeated server-function calls in the same
 * process share a single instance (and run `config.seed` exactly once).
 */

import { bootstrapKon10, type Kon10Instance, type ResolvedConfig } from 'kon10'

// Avoid a hard @types/node dependency for env vars.
declare const process: { env: Record<string, string | undefined> }

const instances = new WeakMap<ResolvedConfig, Promise<Kon10Instance>>()

async function boot(config: ResolvedConfig): Promise<Kon10Instance> {
  if (process.env['NODE_ENV'] === 'production' && !process.env['AUTH_SECRET']) {
    throw new Error(
      '[kon10] AUTH_SECRET environment variable is required in production. ' +
        'Set it to a cryptographically random string (32+ bytes).',
    )
  }
  const kon10 = await bootstrapKon10(config)
  if (config.seed) await config.seed(kon10)
  return kon10
}

/** Get (or lazily create) the running instance for a config. */
export function getRuntime(config: ResolvedConfig): Promise<Kon10Instance> {
  let existing = instances.get(config)
  if (!existing) {
    existing = boot(config)
    instances.set(config, existing)
  }
  return existing
}
