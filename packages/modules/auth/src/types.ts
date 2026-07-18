/**
 * Auth-owned principal + adapter types.
 *
 * These used to live in `kon10`, but the kernel is auth-agnostic: it only
 * knows an opaque `principal`. `@kon10/auth` is the module that gives that
 * principal a concrete shape (`AuthUser`) and casts to it inside its access
 * functions and the RBAC guard.
 */

/** The authenticated user — the principal `@kon10/auth` threads through ops. */
export interface AuthUser {
  id: string
  email?: string | null
  name?: string | null
  /** Names of the roles assigned to this user (resolved from `roles` ids). */
  roles?: string[]
  /** Effective permission keys, the union across all the user's roles. */
  permissions?: string[]
  [key: string]: unknown
}

/** Resolves the current user for an incoming request, or `null`. */
export interface AuthAdapter {
  getUser(request: Request): Promise<AuthUser | null>
}
