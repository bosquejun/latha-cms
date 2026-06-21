/**
 * Access control primitives.
 *
 * Access functions are pure predicates evaluated by the access evaluator
 * before an operation runs. They receive the current user (if any) and,
 * for record-level operations, the document being acted upon.
 */

export type Operation = 'create' | 'read' | 'update' | 'delete'

/** Minimal shape of an authenticated user as seen by access functions. */
export interface AccessUser {
  id: string
  role?: string
  [key: string]: unknown
}

export interface AccessContext<TDoc = Record<string, unknown>> {
  /** The authenticated user, or `null` for anonymous requests. */
  user: AccessUser | null
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

export interface CollectionAccess<TDoc = Record<string, unknown>> {
  read?: AccessFn<TDoc>
  create?: AccessFn<TDoc>
  update?: AccessFn<TDoc>
  delete?: AccessFn<TDoc>
}
