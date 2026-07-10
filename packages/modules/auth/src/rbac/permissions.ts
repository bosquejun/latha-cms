/**
 * Permission primitives — pure string logic, no DB.
 *
 * A permission key is `"<scope>:<action>"`, e.g. `posts:update`. Wildcards:
 *   - `"*"`          — superadmin: matches every permission.
 *   - `"<scope>:*"`  — every action within a scope.
 *   - `"*:<action>"` — an action across every scope.
 *
 * Scopes are derived from entities that declare `entity.actions`, plus the
 * built-in `studio` scope whose `access` action (`studio:access`) gates entry
 * to the Studio UI.
 */

import type { AuthUser } from '../types.js'

/** The permission that gates access to the Studio surface at all. */
export const STUDIO_ACCESS = 'studio:access'

/** The superadmin permission key — matches everything. */
export const SUPERADMIN = '*'

/** System role: the permissions applied to unauthenticated (anonymous) requests. */
export const PUBLIC_ROLE = 'public'

/** System role: the baseline applied to every authenticated user. */
export const AUTHENTICATED_ROLE = 'authenticated'

/** Compose a `<scope>:<action>` permission key. */
export function permissionKey(scope: string, action: string): string {
  return `${scope}:${action}`
}

/** Does a single granted key satisfy the required key (incl. wildcards)? */
export function matchesPermission(granted: string, required: string): boolean {
  if (granted === SUPERADMIN) return true
  if (granted === required) return true

  const [gScope, gAction] = granted.split(':')
  const [rScope, rAction] = required.split(':')
  if (gAction === undefined || rAction === undefined) return false

  const scopeOk = gScope === '*' || gScope === rScope
  const actionOk = gAction === '*' || gAction === rAction
  return scopeOk && actionOk
}

/** Read the effective permission keys off a principal (empty if anonymous). */
export function permissionsOf(principal: unknown): string[] {
  if (!principal || typeof principal !== 'object') return []
  const perms = (principal as AuthUser).permissions
  return Array.isArray(perms) ? perms : []
}

/** Does the principal hold a permission that satisfies `required`? */
export function hasPermission(principal: unknown, required: string): boolean {
  return permissionsOf(principal).some((g) => matchesPermission(g, required))
}
