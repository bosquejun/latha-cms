/**
 * RBAC entities — `roles`, `scopes`, `permissions`.
 *
 * All three live in the Studio `settings` area under an "Access" section.
 * `roles` is editable (admins create roles and assign permissions). `scopes`
 * and `permissions` are a catalog: they are synced from the live config at boot
 * (see `catalog.ts`), so they are effectively read-only references the role
 * form picks from.
 */

import {
  boolean,
  relationship,
  stampFields,
  text,
  type Entity,
} from '@kon10/core'
import { invalidate } from '@kon10/cache'
import { roleIdKey, roleNameKey } from '../cache.js'

export const ROLES_SLUG = 'roles'
export const SCOPES_SLUG = 'scopes'
export const PERMISSIONS_SLUG = 'permissions'

const ACCESS_GROUP = 'Access'

/** Editable: a named bundle of permissions assigned to users. */
export const rolesEntity: Entity = {
  cardinality: 'many',
  slug: ROLES_SLUG,
  actions: ['read', 'create', 'update', 'delete'],
  studio: {
    area: 'settings',
    group: ACCESS_GROUP,
    order: 10,
    // Managed through the Roles & Permissions matrix (the `@kon10/auth/studio`
    // settings page), not its own nav entry or the auto-generated list/form —
    // the matrix enforces the studio:access / superadmin semantics the raw CRUD
    // form would bypass.
    hidden: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'label', 'description'],
    labels: { singular: 'Role', plural: 'Roles' },
  },
  fields: stampFields({
    name: text({ required: true, unique: true }),
    label: text(),
    description: text(),
    // System roles (public/authenticated/admin) are seeded and non-deletable.
    system: boolean({ defaultValue: false, meta: { hidden: true } }),
    permissions: relationship({
      to: PERMISSIONS_SLUG,
      many: true,
      meta: { description: 'Permissions granted to this role.' },
    }),
  }),
  hooks: {
    // System roles (public/authenticated/admin) are seeded and cannot be deleted.
    beforeDelete: [
      ({ data }) => {
        if (data?.system) {
          throw new Error(`The "${data.name}" role is a system role and cannot be deleted.`)
        }
        return data
      },
    ],
    // Invalidate the cached role doc immediately — role/permission changes
    // must not wait out the cache's defense-in-depth TTL.
    afterUpdate: [
      async ({ data, previousDoc, cms }) => {
        await invalidate(cms, roleIdKey(String(data.id)))
        if (typeof data.name === 'string') await invalidate(cms, roleNameKey(data.name))
        if (typeof previousDoc?.name === 'string' && previousDoc.name !== data.name) {
          await invalidate(cms, roleNameKey(previousDoc.name))
        }
        return data
      },
    ],
    afterDelete: [
      async ({ data, cms }) => {
        await invalidate(cms, roleIdKey(String(data.id)))
        if (typeof data.name === 'string') await invalidate(cms, roleNameKey(data.name))
        return data
      },
    ],
  },
}

/** Catalog: a resource that can be acted upon (one per entity). */
export const scopesEntity: Entity = {
  cardinality: 'many',
  slug: SCOPES_SLUG,
  actions: ['read'],
  studio: {
    area: 'settings',
    group: ACCESS_GROUP,
    order: 20,
    // Surfaced through the Roles & Permissions matrix, not its own nav entry.
    hidden: true,
    useAsTitle: 'key',
    defaultColumns: ['key', 'label', 'module'],
    labels: { singular: 'Scope', plural: 'Scopes' },
  },
  fields: stampFields({
    key: text({ required: true, unique: true }),
    label: text(),
    module: text(),
  }),
}

/** Catalog: a grantable `<scope>:<action>` permission. */
export const permissionsEntity: Entity = {
  cardinality: 'many',
  slug: PERMISSIONS_SLUG,
  actions: ['read'],
  studio: {
    area: 'settings',
    group: ACCESS_GROUP,
    order: 30,
    // Surfaced through the Roles & Permissions matrix, not its own nav entry.
    hidden: true,
    useAsTitle: 'key',
    defaultColumns: ['key', 'action', 'module'],
    labels: { singular: 'Permission', plural: 'Permissions' },
  },
  fields: stampFields({
    key: text({ required: true, unique: true }),
    label: text(),
    scope: text(),
    action: text(),
    module: text(),
  }),
}

/** All RBAC entities, in display order. */
export const rbacEntities: Entity[] = [
  rolesEntity,
  scopesEntity,
  permissionsEntity,
]
