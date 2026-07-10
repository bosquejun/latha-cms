/**
 * Access control primitives.
 *
 * Access functions are pure predicates evaluated by the access evaluator
 * before an operation runs. They receive the current **principal** and, for
 * record-level operations, the document being acted upon.
 *
 * The kernel is deliberately auth-agnostic: it never inspects the principal.
 * `principal` is whatever the caller threaded into the operation (an
 * authenticated user, a service identity, `null` for anonymous, …). Modules
 * such as `@kon10/auth` define the concrete principal shape and cast to it
 * inside their access functions and guards.
 */

export type Operation = 'create' | 'read' | 'update' | 'delete'

export interface AccessContext<TDoc = Record<string, unknown>> {
  /**
   * The caller principal, opaque to the kernel. `null` for anonymous callers;
   * otherwise whatever the caller supplied (e.g. an auth user). Cast it to your
   * own principal type inside the predicate.
   */
  principal: unknown
  /** The operation being authorized. */
  operation: Operation
  /** The target document, when the operation is record-level (update/delete/read-one). */
  doc?: TDoc
  /** Inbound request data for create/update operations. */
  data?: unknown
}

export type AccessFn<TDoc = Record<string, unknown>> = (
  ctx: AccessContext<TDoc>,
) => boolean | Promise<boolean>

export interface EntityAccess<TDoc = Record<string, unknown>> {
  read?: AccessFn<TDoc>
  create?: AccessFn<TDoc>
  update?: AccessFn<TDoc>
  delete?: AccessFn<TDoc>
}
