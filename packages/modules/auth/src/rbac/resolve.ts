/**
 * Resolve a user's effective roles + permissions.
 *
 * A user record stores `roles` as an array of role ids. We load those role
 * docs, collect their granted permission ids, and map ids → keys via the synced
 * catalog. The effective permission set is the union across all of the user's
 * roles. Resolved fresh on each request so role/permission changes take effect
 * immediately (the session token only carries the user id).
 */

import type { LathaInstance } from '@latha/core'
import { getCatalog } from './catalog.js'
import { ROLES_SLUG } from './entities.js'

export interface ResolvedGrants {
  /** Names of the roles the user holds. */
  roles: string[]
  /** Effective permission keys (deduplicated union). */
  permissions: string[]
}

/** Resolve `{ roles, permissions }` for a raw user document. */
export async function resolveUserPermissions(
  latha: LathaInstance,
  userDoc: Record<string, unknown>,
): Promise<ResolvedGrants> {
  const roleIds = Array.isArray(userDoc.roles) ? (userDoc.roles as string[]) : []
  if (roleIds.length === 0) return { roles: [], permissions: [] }

  const catalog = getCatalog(latha)
  const roles: string[] = []
  const permissions = new Set<string>()

  for (const roleId of roleIds) {
    const role = await latha.db.findOne(ROLES_SLUG, roleId)
    if (!role) continue
    if (typeof role.name === 'string') roles.push(role.name)
    const permIds = Array.isArray(role.permissions)
      ? (role.permissions as string[])
      : []
    for (const pid of permIds) {
      const key = catalog?.permissionKeyById.get(pid)
      if (key) permissions.add(key)
    }
  }

  return { roles, permissions: [...permissions] }
}
