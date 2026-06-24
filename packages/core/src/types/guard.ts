/**
 * Authorization guards — the kernel's generic authorization seam.
 *
 * A guard is a function the kernel runs for every operation, in registration
 * order, *after* a collection's own `access` predicate. Any guard may throw to
 * deny the operation. The kernel never interprets the principal or the guard's
 * intent — it only runs the chain. This is how cross-cutting authorization
 * (e.g. RBAC in `@latha/auth`) plugs in without the kernel knowing anything
 * about users, roles, or permissions.
 *
 * Modules register guards via `LathaInstance.registerGuard()` during `onInit`.
 */

import type { Operation } from './access.js'
import type { EntityKind } from './collection.js'
import type { LathaInstance } from './config.js'

export interface GuardContext {
  /** The live instance, so guards can resolve entities, query the DB, etc. */
  cms: LathaInstance
  /** The operation being authorized. */
  operation: Operation
  /** Slug of the entity being acted upon. */
  slug: string
  /** Kind of the entity being acted upon. */
  kind: EntityKind
  /** The caller principal, opaque to the kernel. `null` for anonymous. */
  principal: unknown
  /** Inbound data for create/update operations. */
  data?: unknown
  /** Target document for record-level operations. */
  doc?: unknown
  /**
   * Opaque, caller-supplied context bag threaded from the operation. The kernel
   * does not read it; guards interpret it (e.g. an `enforce` flag set by the
   * admin RPC layer but absent on the public API path).
   */
  context: Record<string, unknown>
}

export type Guard = (ctx: GuardContext) => void | Promise<void>
