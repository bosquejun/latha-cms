/**
 * UsersModule — contributes the `users` collection and a role system.
 *
 * Users are an ordinary collection so they get the same storage, validation,
 * admin list/form, and access pipeline as any other entity. The password is
 * never stored in the clear: only a `passwordHash` column exists, and it is
 * hidden from the admin UI. Hashing itself lives in `@latha/auth` — this module
 * only persists whatever hash it is given, keeping storage and crypto separate.
 */

import type { Field, Module } from '@latha/core'

export const USERS_SLUG = 'users'

export interface UsersModuleConfig {
  /** Allowed roles, most-privileged first. Defaults to admin/editor/viewer. */
  roles?: string[]
  /** Extra user fields beyond email / name / role. */
  fields?: Field[]
}

export function UsersModule(config: UsersModuleConfig = {}): Module {
  const roles = config.roles ?? ['admin', 'editor', 'viewer']
  const defaultRole = roles[roles.length - 1]

  const fields: Field[] = [
    { name: 'email', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      options: roles,
      defaultValue: defaultRole,
      admin: { sidebar: true },
    },
    // Write-only credential material — never shown in the admin UI.
    { name: 'passwordHash', type: 'text', admin: { hidden: true } },
    ...(config.fields ?? []),
  ]

  return {
    name: 'users',
    capabilities: ['users'],
    entities: [
      {
        kind: 'collection',
        slug: USERS_SLUG,
        admin: {
          useAsTitle: 'email',
          defaultColumns: ['email', 'name', 'role'],
          labels: { singular: 'User', plural: 'Users' },
        },
        fields,
      },
    ],
  }
}
