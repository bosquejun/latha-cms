/**
 * Hook engine.
 *
 * Runs an ordered list of hook functions, threading the payload through each
 * one. Hooks run sequentially; each receives the output of the previous.
 */

import { noopTracer, withSpan } from '../tracing/index.js'
import type {
  EntityHooks,
  HookArgs,
  HookEvent,
  HookFn,
} from '../types/hook.js'

/**
 * Run a single chain of hooks, folding `data` through each. Each hook call is
 * its own span (`spanName`, default `kon10.hook`) so a slow hook — e.g. one
 * calling out to an external API — shows up distinctly from the surrounding
 * operation in a trace.
 */
export async function runHooks<T extends Record<string, unknown>>(
  hooks: HookFn<T>[] | undefined,
  args: HookArgs<T>,
  spanName = 'kon10.hook',
): Promise<T> {
  if (!hooks || hooks.length === 0) return args.data
  const tracer = args.cms?.tracer ?? noopTracer
  let data = args.data
  for (const hook of hooks) {
    data = await withSpan(tracer, spanName, async (span) => {
      span.setAttributes({ 'kon10.entity': args.slug, 'kon10.operation': args.operation })
      return hook({ ...args, data })
    })
  }
  return data
}

/** Convenience: pull the chain for `event` off an `EntityHooks` map and run it. */
export async function runHookEvent<T extends Record<string, unknown>>(
  entityHooks: EntityHooks<T> | undefined,
  event: HookEvent,
  args: HookArgs<T>,
): Promise<T> {
  return runHooks(entityHooks?.[event], args, `kon10.hook.${event}`)
}
