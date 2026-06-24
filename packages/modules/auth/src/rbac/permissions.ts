/**
 * Permission primitives — pure string logic, no DB.
 *
 * A permission key is `"<scope>:<action>"`, e.g. `posts:update`. Wildcards:
 *   - `"*"`          — superadmin: matches every permission.
 *   - `"<scope>:*"`  — every action within a scope.
 *   - `"*:<action>"` — an action across every scope.
 *
 * Scopes are derived one-per-entity (so a `posts` collection yields the
 * `posts` scope with create/read/update/delete), plus the built-in `admin`
 * scope whose `access` action (`admin:access`) gates entry to the admin UI.
 */

import type { EntityKind, Operation } from '@latha/core'
import type { AuthUser } from '../types.js'

/** The permission that gates access to the admin surface at all. */
export const ADMIN_ACCESS = 'admin:access'

/** The superadmin permission key — matches everything. */
export const SUPERADMIN = '*'

/** Compose a `<scope>:<action>` permission key. */
export function permissionKey(scope: string, action: string): string {
  return `${scope}:${action}`
}

/** The grantable actions for an entity of the given kind. */
export function actionsForKind(kind: EntityKind): Operation[] {
  switch (kind) {
    case 'collection':
      return ['read', 'create', 'update', 'delete']
    case 'document':
      return ['read', 'update']
    case 'taxonomy':
      return ['read', 'create', 'delete']
  }
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
