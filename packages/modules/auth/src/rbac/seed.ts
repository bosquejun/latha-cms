/**
 * Default role seeding.
 *
 * On first run (empty `roles` table) we seed a sensible starter set, computed
 * against the live catalog so the grants reference real permissions:
 *   - `admin`  — superadmin (`*`).
 *   - `editor` — admin access + read/create/update on non-sensitive scopes.
 *   - `viewer` — admin access + read on non-sensitive scopes.
 *
 * "Sensitive" scopes (users, roles, scopes, permissions, admin) are reserved
 * for the superadmin. These are only starting points — admins refine roles in
 * the UI. An app can override the set via `AuthModule({ roles })`.
 */

import type { LathaInstance } from '@latha/core'
import { getCatalog, type RbacCatalog } from './catalog.js'
import { ROLES_SLUG } from './entities.js'
import { ADMIN_ACCESS, SUPERADMIN } from './permissions.js'

export interface RoleSeed {
  name: string
  label?: string
  description?: string
  /** Permission keys to grant (may include wildcards / `*`). */
  permissions: string[]
}

const SENSITIVE = new Set([
  'users',
  'roles',
  'scopes',
  'permissions',
  'admin',
  '*',
])

/** Built-in default roles, computed against the live catalog. */
export function defaultRoles(catalog: RbacCatalog): RoleSeed[] {
  const editable = catalog.scopes
    .map((s) => s.key)
    .filter((key) => !SENSITIVE.has(key))

  return [
    {
      name: 'admin',
      label: 'Administrator',
      description: 'Full access to everything.',
      permissions: [SUPERADMIN],
    },
    {
      name: 'editor',
      label: 'Editor',
      description: 'Create and edit content.',
      permissions: [
        ADMIN_ACCESS,
        ...editable.flatMap((s) => [`${s}:read`, `${s}:create`, `${s}:update`]),
      ],
    },
    {
      name: 'viewer',
      label: 'Viewer',
      description: 'Read-only access to content.',
      permissions: [ADMIN_ACCESS, ...editable.map((s) => `${s}:read`)],
    },
  ]
}

/** Seed roles into the DB when the `roles` table is empty. */
export async function seedRoles(
  latha: LathaInstance,
  roles: RoleSeed[],
): Promise<void> {
  if ((await latha.db.count(ROLES_SLUG)) > 0) return

  const catalog = getCatalog(latha)
  for (const role of roles) {
    const permissionIds = role.permissions
      .map((key) => catalog?.permissionIdByKey.get(key))
      .filter((id): id is string => typeof id === 'string')

    await latha.db.create(ROLES_SLUG, {
      name: role.name,
      label: role.label ?? role.name,
      description: role.description ?? '',
      permissions: permissionIds,
    })
  }
}

/** Look up a role document by its unique name. */
export async function getRoleByName(
  latha: LathaInstance,
  name: string,
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const rows = await latha.db.find(ROLES_SLUG, { where: { name }, limit: 1 })
  return rows[0] ?? null
}
