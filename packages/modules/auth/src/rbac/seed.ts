/**
 * Default role seeding.
 *
 * On first run (empty `roles` table) we seed a Strapi-style starter set,
 * computed against the live catalog so the grants reference real permissions:
 *   - `admin`         — superadmin (`*`). System, non-deletable.
 *   - `editor`        — Studio access + read/create/update on non-sensitive scopes.
 *   - `viewer`        — Studio access + read on non-sensitive scopes.
 *   - `public`        — permissions for anonymous requests. System, empty by
 *                       default; admins grant public reads in the matrix UI.
 *   - `authenticated` — baseline for every logged-in user. System, empty by
 *                       default.
 *
 * Auth-owned scopes (roles, scopes, permissions, studio) and the identity-store
 * scope are reserved for the superadmin. These are only starting points —
 * admins refine roles in the UI. An app can override via `AuthModule({ roles })`.
 */

import type { Kon10Instance } from '@kon10/core'
import { getCatalog, type RbacCatalog } from './catalog.js'
import { ROLES_SLUG } from './entities.js'
import {
  STUDIO_ACCESS,
  AUTHENTICATED_ROLE,
  PUBLIC_ROLE,
  SUPERADMIN,
} from './permissions.js'

export interface RoleSeed {
  name: string
  label?: string
  description?: string
  /** Permission keys to grant (may include wildcards / `*`). */
  permissions: string[]
  /** Mark as a system role — seeded and non-deletable. */
  system?: boolean
}

/** Auth-owned scopes that are always reserved for the superadmin. */
const AUTH_SENSITIVE = new Set(['roles', 'scopes', 'permissions', 'api-keys', 'studio', '*'])

/**
 * Built-in default roles, computed against the live catalog.
 *
 * `extraSensitive` lists additional scope slugs to withhold from the default
 * editor/viewer grants — typically the identity-store slug, passed by the
 * module so that whatever entity is configured as the user store is
 * automatically protected without hardcoding a slug here.
 */
export function defaultRoles(catalog: RbacCatalog, extraSensitive: string[] = []): RoleSeed[] {
  const sensitive = extraSensitive.length
    ? new Set([...AUTH_SENSITIVE, ...extraSensitive])
    : AUTH_SENSITIVE
  const editable = catalog.scopes
    .map((s) => s.key)
    .filter((key) => !sensitive.has(key))

  return [
    {
      name: 'admin',
      label: 'Administrator',
      description: 'Full access to everything.',
      permissions: [SUPERADMIN],
      system: true,
    },
    {
      name: 'editor',
      label: 'Editor',
      description: 'Create and edit content.',
      permissions: [
        STUDIO_ACCESS,
        ...editable.flatMap((s) => [`${s}:read`, `${s}:create`, `${s}:update`]),
      ],
    },
    {
      name: 'viewer',
      label: 'Viewer',
      description: 'Read-only access to content.',
      permissions: [STUDIO_ACCESS, ...editable.map((s) => `${s}:read`)],
    },
    {
      name: PUBLIC_ROLE,
      label: 'Public',
      description: 'Applied to unauthenticated requests. Grant public reads here.',
      permissions: [],
      system: true,
    },
    {
      name: AUTHENTICATED_ROLE,
      label: 'Authenticated',
      description: 'Baseline granted to every logged-in user.',
      permissions: [],
      system: true,
    },
  ]
}

/** Seed roles into the DB when the `roles` table is empty. */
export async function seedRoles(
  kon10: Kon10Instance,
  roles: RoleSeed[],
): Promise<void> {
  if ((await kon10.db.count(ROLES_SLUG)) > 0) return

  const catalog = getCatalog(kon10)
  for (const role of roles) {
    const permissionIds = role.permissions
      .map((key) => catalog?.permissionIdByKey.get(key))
      .filter((id): id is string => typeof id === 'string')

    await kon10.db.create(ROLES_SLUG, {
      name: role.name,
      label: role.label ?? role.name,
      description: role.description ?? '',
      permissions: permissionIds,
      system: role.system ?? false,
    })
  }
}

/** Look up a role document by its unique name. */
export async function getRoleByName(
  kon10: Kon10Instance,
  name: string,
): Promise<(Record<string, unknown> & { id: string }) | null> {
  const rows = await kon10.db.find(ROLES_SLUG, { where: { name }, limit: 1 })
  return rows[0] ?? null
}
