/**
 * Hook engine.
 *
 * Runs an ordered list of hook functions, threading the payload through each
 * one. Hooks run sequentially; each receives the output of the previous.
 */

import type {
  CollectionHooks,
  HookArgs,
  HookEvent,
  HookFn,
} from '../types/hook.js'

/** Run a single chain of hooks, folding `data` through each. */
export async function runHooks<T extends Record<string, unknown>>(
  hooks: HookFn<T>[] | undefined,
  args: HookArgs<T>,
): Promise<T> {
  if (!hooks || hooks.length === 0) return args.data
  let data = args.data
  for (const hook of hooks) {
    data = await hook({ ...args, data })
  }
  return data
}

/** Convenience: pull the chain for `event` off a `CollectionHooks` map and run it. */
export async function runHookEvent<T extends Record<string, unknown>>(
  collectionHooks: CollectionHooks<T> | undefined,
  event: HookEvent,
  args: HookArgs<T>,
): Promise<T> {
  return runHooks(collectionHooks?.[event], args)
}
