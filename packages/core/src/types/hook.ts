/**
 * Lifecycle hook primitives.
 *
 * Hooks are ordered transformers run around persistence operations. A
 * `before*` hook may mutate and return the payload it receives; an `after*`
 * hook may transform the persisted document before it is returned.
 */

import type { Operation } from './access.js'
import type { Kon10Instance } from './config.js'

export interface HookArgs<T = Record<string, unknown>> {
  /** The mutable payload — input data for `before*`, the saved doc for `after*`. */
  data: T
  /** The caller principal, opaque to the kernel, or `null` for anonymous. */
  principal: unknown
  /** The operation this hook is participating in. */
  operation: Operation
  /** Slug of the entity the hook is bound to. */
  slug: string
  /** Previous version of the document, when available (updates). */
  previousDoc?: T
  /** The live instance this hook is running under — e.g. to reach `cms.cache`, `cms.db`. */
  cms: Kon10Instance
}

export type HookFn<T = Record<string, unknown>> = (
  args: HookArgs<T>,
) => T | Promise<T>

export interface EntityHooks<T = Record<string, unknown>> {
  beforeCreate?: HookFn<T>[]
  afterCreate?: HookFn<T>[]
  beforeUpdate?: HookFn<T>[]
  afterUpdate?: HookFn<T>[]
  beforeDelete?: HookFn<T>[]
  afterDelete?: HookFn<T>[]
}

export type HookEvent = keyof EntityHooks
