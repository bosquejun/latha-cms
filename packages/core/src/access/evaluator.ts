/**
 * Access evaluator.
 *
 * Given a collection's access map and a context, decide whether an operation
 * is permitted. The default policy is deny-by-default for writes and
 * allow-by-default for reads is intentionally NOT used: when no access
 * function is declared for an operation, the operation is allowed. Modules
 * that need stricter defaults supply explicit access functions.
 */

import type {
  AccessContext,
  AccessFn,
  CollectionAccess,
  Operation,
} from '../types/access.js'

export class AccessDeniedError extends Error {
  readonly operation: Operation
  constructor(operation: Operation, collection: string) {
    super(`Access denied: cannot ${operation} on "${collection}".`)
    this.name = 'AccessDeniedError'
    this.operation = operation
  }
}

/** Resolve whether `ctx.operation` is allowed under `access`. */
export async function evaluateAccess(
  access: CollectionAccess | undefined,
  ctx: AccessContext,
): Promise<boolean> {
  if (!access) return true
  const fn: AccessFn | undefined = access[ctx.operation]
  if (!fn) return true
  return Boolean(await fn(ctx))
}

/** Like {@link evaluateAccess} but throws {@link AccessDeniedError} on denial. */
export async function assertAccess(
  access: CollectionAccess | undefined,
  ctx: AccessContext,
  collection: string,
): Promise<void> {
  const allowed = await evaluateAccess(access, ctx)
  if (!allowed) throw new AccessDeniedError(ctx.operation, collection)
}
