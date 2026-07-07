/**
 * API key service — server-side creation and bearer-token verification.
 *
 * `verifyApiKeyToken` is the delivery API's auth path: hash the presented
 * token, look the hash up, and resolve the attached roles to permissions.
 * Grants are resolved fresh per request (like sessions), so role edits and
 * key revocation take effect immediately.
 */

import type { LathaInstance } from '@latha/core'
import { resolveRoleGrants } from '../rbac/resolve.js'
import { API_KEYS_SLUG } from './entities.js'
import {
  API_KEY_TOKEN_PREFIX,
  apiKeyDisplayPrefix,
  generateApiKeyToken,
  hashApiKeyToken,
} from './token.js'

/** The principal a verified API key resolves to. */
export interface ApiKeyPrincipal {
  /** `apikey:<doc id>` — distinguishable from user ids in hooks/audit logs. */
  id: string
  kind: 'api-key'
  name: string
  roles: string[]
  permissions: string[]
}

export interface CreateApiKeyInput {
  name: string
  /** Role document ids whose permissions the key carries. */
  roles?: string[]
  expiresAt?: Date
}

/**
 * Create an API key (system-level, bypassing RBAC — callers gate access).
 * Returns the plaintext token exactly once; only its hash is stored.
 */
export async function createApiKey(
  latha: LathaInstance,
  input: CreateApiKeyInput,
): Promise<{ id: string; token: string }> {
  const token = generateApiKeyToken()
  const doc = await latha.db.create(API_KEYS_SLUG, {
    name: input.name,
    keyHash: await hashApiKeyToken(token),
    prefix: apiKeyDisplayPrefix(token),
    roles: input.roles ?? [],
    enabled: true,
    ...(input.expiresAt ? { expiresAt: input.expiresAt.toISOString() } : {}),
  })
  return { id: doc.id, token }
}

/**
 * Resolve a presented bearer token to its principal, or `null` when the token
 * is malformed, unknown, disabled, or expired.
 */
export async function verifyApiKeyToken(
  latha: LathaInstance,
  token: string,
): Promise<ApiKeyPrincipal | null> {
  if (!token.startsWith(API_KEY_TOKEN_PREFIX)) return null
  const keyHash = await hashApiKeyToken(token)
  const doc = (await latha.db.find(API_KEYS_SLUG, { where: { keyHash }, limit: 1 }))[0]
  if (!doc || doc.enabled === false) return null
  if (doc.expiresAt != null && doc.expiresAt !== '') {
    const expiry = new Date(String(doc.expiresAt))
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() <= Date.now()) return null
  }
  const roleIds = Array.isArray(doc.roles) ? (doc.roles as string[]) : []
  const { roles, permissions } = await resolveRoleGrants(latha, roleIds)
  return {
    id: `apikey:${doc.id}`,
    kind: 'api-key',
    name: typeof doc.name === 'string' ? doc.name : '',
    roles,
    permissions,
  }
}
