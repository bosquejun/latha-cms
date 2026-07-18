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
  number,
  relationship,
  select,
  stampFields,
  text,
  z,
  type Entity,
} from 'kon10'
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
    defaultColumns: ['name', 'type', 'prefix', 'enabled'],
    labels: { singular: 'API Key', plural: 'API Keys' },
  },
  fields: stampFields({
    name: text({ required: true }),
    // SHA-256 of the full token; the token itself is never stored.
    keyHash: text({ required: true, unique: true, meta: { hidden: true } }),
    // Identifying head of the token (`kon10_pk_Ab12Cd34`), safe to display.
    prefix: text({ required: true }),
    // `publishable` keys are safe to embed in client code — read-only, published
    // content only, optionally origin-bound and rate-limited. `secret` keys are
    // server-only with broader access. Legacy keys (no type) resolve as secret.
    type: select({
      options: z.enum(['secret', 'publishable']),
      defaultValue: 'secret',
      meta: { description: 'Secret (server-only) or publishable (safe in client code).' },
    }),
    roles: relationship({
      to: ROLES_SLUG,
      many: true,
      meta: { description: 'Roles whose permissions this key carries.' },
    }),
    // Publishable-key guardrails.
    allowedOrigins: text({
      meta: {
        description:
          'Comma-separated Origins a publishable key may be used from. Empty = any origin.',
      },
    }),
    rateLimitPerMinute: number({
      integer: true,
      meta: { description: 'Max requests/minute for this key. Empty = no per-key limit.' },
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
