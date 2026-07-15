/**
 * API key service — server-side creation and bearer-token verification.
 *
 * `verifyApiKeyToken` is the delivery API's auth path: hash the presented
 * token, look the hash up, and resolve the attached roles to permissions.
 * Grants are resolved fresh per request (like sessions), so role edits and
 * key revocation take effect immediately.
 */

import type { Kon10Instance } from '@kon10/core'
import { cached } from '@kon10/cache'
import { AUTH_CACHE_TTL_SECONDS, apiKeyHashKey } from '../cache.js'
import { resolveRoleGrants } from '../rbac/resolve.js'
import { API_KEYS_SLUG } from './entities.js'
import {
  API_KEY_TOKEN_PREFIX,
  apiKeyDisplayPrefix,
  generateApiKeyToken,
  hashApiKeyToken,
  type ApiKeyClass,
} from './token.js'

/** The principal a verified API key resolves to. */
export interface ApiKeyPrincipal {
  /** `apikey:<doc id>` — distinguishable from user ids in hooks/audit logs. */
  id: string
  kind: 'api-key'
  name: string
  roles: string[]
  permissions: string[]
  /** `true` for a publishable (`kon10_pk_…`) key — read-only, published content. */
  publishable: boolean
  /** Origins a publishable key may be used from; empty/undefined = any. */
  allowedOrigins?: string[]
  /** Per-key request budget per minute; undefined = no per-key limit. */
  rateLimitPerMinute?: number
}

export interface CreateApiKeyInput {
  name: string
  /** Secret (default) or publishable. */
  type?: ApiKeyClass
  /** Role document ids whose permissions the key carries. */
  roles?: string[]
  /** Origins a publishable key may be used from. */
  allowedOrigins?: string[]
  /** Per-key request budget per minute. */
  rateLimitPerMinute?: number
  expiresAt?: Date
}

/** Parse the stored comma-separated origins into a trimmed list (or undefined). */
function parseOrigins(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string') return undefined
  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  return list.length > 0 ? list : undefined
}

/**
 * Create an API key (system-level, bypassing RBAC — callers gate access).
 * Returns the plaintext token exactly once; only its hash is stored.
 */
export async function createApiKey(
  kon10: Kon10Instance,
  input: CreateApiKeyInput,
): Promise<{ id: string; token: string }> {
  const type: ApiKeyClass = input.type ?? 'secret'
  const token = generateApiKeyToken(type)
  const doc = await kon10.db.create(API_KEYS_SLUG, {
    name: input.name,
    keyHash: await hashApiKeyToken(token),
    prefix: apiKeyDisplayPrefix(token),
    type,
    roles: input.roles ?? [],
    enabled: true,
    ...(input.allowedOrigins?.length ? { allowedOrigins: input.allowedOrigins.join(',') } : {}),
    ...(input.rateLimitPerMinute != null ? { rateLimitPerMinute: input.rateLimitPerMinute } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt.toISOString() } : {}),
  })
  return { id: doc.id, token }
}

/**
 * Resolve a presented bearer token to its principal, or `null` when the token
 * is malformed, unknown, disabled, or expired.
 */
export async function verifyApiKeyToken(
  kon10: Kon10Instance,
  token: string,
): Promise<ApiKeyPrincipal | null> {
  if (!token.startsWith(API_KEY_TOKEN_PREFIX)) return null
  const keyHash = await hashApiKeyToken(token)
  const doc = await cached(kon10, apiKeyHashKey(keyHash), AUTH_CACHE_TTL_SECONDS, async () => {
    const rows = await kon10.db.find(API_KEYS_SLUG, { where: { keyHash }, limit: 1 })
    return rows[0] ?? null
  })
  if (!doc || doc.enabled === false) return null
  if (doc.expiresAt != null && doc.expiresAt !== '') {
    const expiry = new Date(String(doc.expiresAt))
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() <= Date.now()) return null
  }
  const roleIds = Array.isArray(doc.roles) ? (doc.roles as string[]) : []
  const { roles, permissions } = await resolveRoleGrants(kon10, roleIds)
  const publishable = doc.type === 'publishable'
  const rateLimitPerMinute =
    typeof doc.rateLimitPerMinute === 'number' && doc.rateLimitPerMinute > 0
      ? doc.rateLimitPerMinute
      : undefined
  return {
    id: `apikey:${doc.id}`,
    kind: 'api-key',
    name: typeof doc.name === 'string' ? doc.name : '',
    roles,
    permissions,
    publishable,
    allowedOrigins: parseOrigins(doc.allowedOrigins),
    rateLimitPerMinute,
  }
}
