/**
 * UsersModule — contributes the `users` collection and a role system.
 *
 * Users are an ordinary collection so they get the same storage, validation,
 * admin list/form, and access pipeline as any other entity. The password is
 * never stored in the clear: only a `passwordHash` column exists, and it is
 * hidden from the admin UI. Hashing itself lives in `@latha/auth` — this module
 * only persists whatever hash it is given, keeping storage and crypto separate.
 */

import { relationship, stampFields, text } from '@latha/core'
import type { FieldsRecord, Module } from '@latha/core'

export const USERS_SLUG = 'users'

export interface UsersModuleConfig {
  /** Extra user fields beyond email / name / roles. */
  fields?: FieldsRecord
}

export function UsersModule(config: UsersModuleConfig = {}): Module {
  const fields = stampFields({
    email: text({ required: true, unique: true }),
    name: text(),
    // RBAC roles (defined by @latha/auth). A user holds many; effective
    // permissions are the union across them.
    roles: relationship({
      to: 'roles',
      many: true,
      meta: { sidebar: true, description: 'Roles assigned to this user.' },
    }),
    // Write-only credential material — never shown in the admin UI.
    passwordHash: text({ meta: { hidden: true } }),
    ...(config.fields ?? {}),
  })

  return {
    name: 'users',
    capabilities: ['users'],
    entities: [
      {
        kind: 'collection',
        slug: USERS_SLUG,
        admin: {
          // Lives in the settings sidebar (behind the Settings button) rather
          // than the main nav.
          area: 'settings',
          useAsTitle: 'email',
          defaultColumns: ['email', 'name', 'roles'],
          labels: { singular: 'User', plural: 'Users' },
        },
        fields,
      },
    ],
  }
}
