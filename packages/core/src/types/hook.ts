/**
 * Lifecycle hook primitives.
 *
 * Hooks are ordered transformers run around persistence operations. A
 * `before*` hook may mutate and return the payload it receives; an `after*`
 * hook may transform the persisted document before it is returned.
 */

import type { AccessUser, Operation } from './access.js'

export interface HookArgs<T = Record<string, unknown>> {
  /** The mutable payload — input data for `before*`, the saved doc for `after*`. */
  data: T
  /** The authenticated user, or `null`. */
  user: AccessUser | null
  /** The operation this hook is participating in. */
  operation: Operation
  /** Slug of the collection/document the hook is bound to. */
  collection: string
  /** Previous version of the document, when available (updates). */
  previousDoc?: T
}

export type HookFn<T = Record<string, unknown>> = (
  args: HookArgs<T>,
) => T | Promise<T>

export interface CollectionHooks<T = Record<string, unknown>> {
  beforeCreate?: HookFn<T>[]
  afterCreate?: HookFn<T>[]
  beforeUpdate?: HookFn<T>[]
  afterUpdate?: HookFn<T>[]
  beforeDelete?: HookFn<T>[]
  afterDelete?: HookFn<T>[]
}

export type HookEvent = keyof CollectionHooks
