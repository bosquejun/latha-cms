/**
 * RBAC entities — `roles`, `scopes`, `permissions`.
 *
 * All three live in the admin `settings` area under an "Access" section.
 * `roles` is editable (admins create roles and assign permissions). `scopes`
 * and `permissions` are a catalog: they are synced from the live config at boot
 * (see `catalog.ts`), so they are effectively read-only references the role
 * form picks from.
 */

import { relationship, stampFields, text, type Entity } from '@latha/core'

export const ROLES_SLUG = 'roles'
export const SCOPES_SLUG = 'scopes'
export const PERMISSIONS_SLUG = 'permissions'

const ACCESS_GROUP = 'Access'

/** Editable: a named bundle of permissions assigned to users. */
export const rolesEntity: Entity = {
  kind: 'collection',
  slug: ROLES_SLUG,
  admin: {
    area: 'settings',
    group: ACCESS_GROUP,
    order: 10,
    useAsTitle: 'name',
    defaultColumns: ['name', 'label', 'description'],
    labels: { singular: 'Role', plural: 'Roles' },
  },
  fields: stampFields({
    name: text({ required: true, unique: true }),
    label: text(),
    description: text(),
    permissions: relationship({
      to: PERMISSIONS_SLUG,
      many: true,
      admin: { description: 'Permissions granted to this role.' },
    }),
  }),
}

/** Catalog: a resource that can be acted upon (one per entity). */
export const scopesEntity: Entity = {
  kind: 'collection',
  slug: SCOPES_SLUG,
  admin: {
    area: 'settings',
    group: ACCESS_GROUP,
    order: 20,
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
  kind: 'collection',
  slug: PERMISSIONS_SLUG,
  admin: {
    area: 'settings',
    group: ACCESS_GROUP,
    order: 30,
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
