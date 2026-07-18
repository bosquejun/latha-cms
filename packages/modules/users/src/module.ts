/**
 * UsersModule — contributes the `users` collection and a role system.
 *
 * Users are an ordinary collection so they get the same storage, validation,
 * Studio list/form, and access pipeline as any other entity. The password is
 * never stored in the clear: only a `passwordHash` column exists, and it is
 * hidden from the Studio UI. Hashing itself lives in `@kon10/auth` — this module
 * only persists whatever hash it is given, keeping storage and crypto separate.
 */

import { relationship, stampFields, text, z } from '@kon10/core'
import type { FieldsRecord, Module } from '@kon10/core'

export const USERS_SLUG = 'users'

export interface UsersModuleConfig {
  /** Extra user fields beyond email / name / roles. */
  fields?: FieldsRecord
}

export function UsersModule(config: UsersModuleConfig = {}): Module {
  const fields = stampFields({
    // The login identity — the zod-first escape hatch (`schema`) enforces
    // real email format server-side, mirrored to the Studio form via jsonSchema.
    email: text({ required: true, unique: true, schema: z.email() }),
    name: text(),
    // RBAC roles (defined by @kon10/auth). A user holds many; effective
    // permissions are the union across them.
    roles: relationship({
      to: 'roles',
      many: true,
      meta: { sidebar: true, description: 'Roles assigned to this user.' },
    }),
    passwordHash: text({ meta: { hidden: true } }),
    ...(config.fields ?? {}),
  })

  return {
    name: 'users',
    capabilities: ['users'],
    entities: [
      {
        cardinality: 'many',
        slug: USERS_SLUG,
        studio: {
          // Lives in the Settings tab's rail rather than the main nav.
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
