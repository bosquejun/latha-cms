/**
 * The `api-keys` entity — bearer credentials for headless/machine consumers.
 *
 * A key carries roles (the same RBAC vocabulary as users); its effective
 * permissions are the union across them, without the Authenticated baseline.
 * Only the token's SHA-256 hash is stored (see `token.ts`). Managed through
 * the API Keys settings page, not the auto-generated form — creating a key
 * requires generating a secret and showing it exactly once, which the generic
 * CRUD form cannot do.
 */

import {
  boolean,
  date,
  relationship,
  stampFields,
  text,
  type Entity,
} from '@kon10/core'
import { invalidate } from '@kon10/cache'
import { apiKeyHashKey } from '../cache.js'
import { ROLES_SLUG } from '../rbac/entities.js'

export const API_KEYS_SLUG = 'api-keys'

export const apiKeysEntity: Entity = {
  cardinality: 'many',
  slug: API_KEYS_SLUG,
  actions: ['read', 'create', 'update', 'delete'],
  studio: {
    area: 'settings',
    group: 'Access',
    order: 40,
    // Managed through the API Keys settings page (`@kon10/auth/studio`).
    hidden: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'prefix', 'enabled'],
    labels: { singular: 'API Key', plural: 'API Keys' },
  },
  fields: stampFields({
    name: text({ required: true }),
    // SHA-256 of the full token; the token itself is never stored.
    keyHash: text({ required: true, unique: true, meta: { hidden: true } }),
    // Identifying head of the token (`kon10_Ab12Cd34`), safe to display.
    prefix: text({ required: true }),
    roles: relationship({
      to: ROLES_SLUG,
      many: true,
      meta: { description: 'Roles whose permissions this key carries.' },
    }),
    enabled: boolean({ defaultValue: true }),
    expiresAt: date({
      meta: { description: 'Optional expiry — the key stops working after this instant.' },
    }),
  }),
  hooks: {
    // Revoking/disabling/editing or deleting a key must take effect
    // immediately, not wait out the cache's defense-in-depth TTL.
    afterUpdate: [
      async ({ data, cms }) => {
        await invalidate(cms, apiKeyHashKey(String(data.keyHash)))
        return data
      },
    ],
    afterDelete: [
      async ({ data, cms }) => {
        await invalidate(cms, apiKeyHashKey(String(data.keyHash)))
        return data
      },
    ],
  },
}
