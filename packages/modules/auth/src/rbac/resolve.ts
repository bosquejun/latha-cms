/**
 * Resolve effective roles + permissions for a principal.
 *
 * A user record stores `roles` as an array of role ids. We load those role docs,
 * collect their granted permission ids, and map ids → keys via the synced
 * catalog. The effective set is the union across the user's roles **plus the
 * Authenticated baseline** (every logged-in user implicitly carries the
 * `authenticated` system role). Anonymous requests instead resolve to the
 * `public` system role via {@link getPublicPrincipal}.
 *
 * Resolved fresh on each request so role/permission changes take effect
 * immediately (the session token only carries the user id).
 */

import type { LathaInstance } from '@latha/core'
import { getCatalog, type RbacCatalog } from './catalog.js'
import { ROLES_SLUG } from './entities.js'
import { AUTHENTICATED_ROLE, PUBLIC_ROLE } from './permissions.js'

export interface ResolvedGrants {
  /** Names of the roles the principal holds. */
  roles: string[]
  /** Effective permission keys (deduplicated union). */
  permissions: string[]
}

/** The permission keys granted by a single role document. */
function keysFromRole(
  catalog: RbacCatalog | undefined,
  role: Record<string, unknown>,
): string[] {
  const ids = Array.isArray(role.permissions)
    ? (role.permissions as string[])
    : []
  const keys: string[] = []
  for (const id of ids) {
    const key = catalog?.permissionKeyById.get(id)
    if (key) keys.push(key)
  }
  return keys
}

/** Load a role document by its unique name. */
async function roleByName(
  latha: LathaInstance,
  name: string,
): Promise<Record<string, unknown> | null> {
  const rows = await latha.db.find(ROLES_SLUG, { where: { name }, limit: 1 })
  return rows[0] ?? null
}

/** The permission keys granted by a role, looked up by name. */
export async function getRolePermissions(
  latha: LathaInstance,
  name: string,
): Promise<string[]> {
  const role = await roleByName(latha, name)
  return role ? keysFromRole(getCatalog(latha), role) : []
}

/**
 * Resolve `{ roles, permissions }` for a list of role document ids — the
 * shared core of user and API-key grant resolution. No implicit baseline:
 * callers add one where it applies (logged-in users get Authenticated;
 * API keys carry exactly their roles).
 */
export async function resolveRoleGrants(
  latha: LathaInstance,
  roleIds: string[],
): Promise<ResolvedGrants> {
  const catalog = getCatalog(latha)
  const roles: string[] = []
  const permissions = new Set<string>()

  for (const roleId of roleIds) {
    const role = await latha.db.findOne(ROLES_SLUG, roleId)
    if (!role) continue
    if (typeof role.name === 'string') roles.push(role.name)
    for (const key of keysFromRole(catalog, role)) permissions.add(key)
  }

  return { roles, permissions: [...permissions] }
}

/** Resolve `{ roles, permissions }` for a logged-in user document. */
export async function resolveUserPermissions(
  latha: LathaInstance,
  userDoc: Record<string, unknown>,
): Promise<ResolvedGrants> {
  const roleIds = Array.isArray(userDoc.roles) ? (userDoc.roles as string[]) : []
  const { roles, permissions: keys } = await resolveRoleGrants(latha, roleIds)
  const permissions = new Set(keys)

  // Every logged-in user implicitly carries the Authenticated baseline.
  for (const key of await getRolePermissions(latha, AUTHENTICATED_ROLE)) {
    permissions.add(key)
  }
  if (!roles.includes(AUTHENTICATED_ROLE)) roles.push(AUTHENTICATED_ROLE)

  return { roles, permissions: [...permissions] }
}

/** The synthetic principal for anonymous requests (the Public role). */
export interface PublicPrincipal {
  id: '__public__'
  roles: string[]
  permissions: string[]
}

/** Build the principal applied to unauthenticated requests. */
export async function getPublicPrincipal(
  latha: LathaInstance,
): Promise<PublicPrincipal> {
  return {
    id: '__public__',
    roles: [PUBLIC_ROLE],
    permissions: await getRolePermissions(latha, PUBLIC_ROLE),
  }
}
