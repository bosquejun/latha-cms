/**
 * API key token helpers — generation, hashing, display prefix.
 *
 * Client-safe (pure Web Crypto): the Studio UI generates a token in the
 * browser and stores only its hash via the standard create RPC, so the
 * plaintext never even transits the server outside the request that uses it.
 *
 * A token is `kon10_` + 256 random bits (base64url). Only the SHA-256 hex of
 * the full token is persisted — tokens are high-entropy, so a fast
 * deterministic hash is the right trade-off (it doubles as the unique lookup
 * key, unlike a salted KDF).
 */

import { toBase64Url } from '../crypto.js'

/** The umbrella prefix every key token carries — how the delivery API detects a bearer. */
export const API_KEY_TOKEN_PREFIX = 'kon10_'
/** Publishable keys are safe to embed in client code (read-only, published content). */
export const PUBLISHABLE_TOKEN_PREFIX = 'kon10_pk_'
/** Secret keys are server-only; broader access. */
export const SECRET_TOKEN_PREFIX = 'kon10_sk_'

/** The two key classes. */
export type ApiKeyClass = 'secret' | 'publishable'

/** Token chars shown after the class prefix in a display prefix. */
const DISPLAY_TOKEN_CHARS = 8

const textEncoder = new TextEncoder()

/**
 * Generate a fresh API key token: `kon10_<pk|sk>_<base64url(32 random bytes)>`.
 * Defaults to a secret key so existing callers keep server-only semantics.
 */
export function generateApiKeyToken(type: ApiKeyClass = 'secret'): string {
  const prefix = type === 'publishable' ? PUBLISHABLE_TOKEN_PREFIX : SECRET_TOKEN_PREFIX
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return prefix + toBase64Url(bytes)
}

/**
 * The class a token belongs to. Legacy `kon10_<rand>` tokens (no `pk`/`sk`
 * segment) are treated as secret — the safe default.
 */
export function apiKeyClassOf(token: string): ApiKeyClass {
  return token.startsWith(PUBLISHABLE_TOKEN_PREFIX) ? 'publishable' : 'secret'
}

/** Length of the class prefix a token carries (falls back to the umbrella prefix). */
function classPrefixLength(token: string): number {
  if (token.startsWith(PUBLISHABLE_TOKEN_PREFIX)) return PUBLISHABLE_TOKEN_PREFIX.length
  if (token.startsWith(SECRET_TOKEN_PREFIX)) return SECRET_TOKEN_PREFIX.length
  return API_KEY_TOKEN_PREFIX.length
}

/** SHA-256 hex of the full token — the only form that is ever stored. */
export async function hashApiKeyToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(token) as BufferSource,
  )
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** The identifying prefix persisted alongside the hash (e.g. `kon10_pk_Ab12Cd34`). */
export function apiKeyDisplayPrefix(token: string): string {
  return token.slice(0, classPrefixLength(token) + DISPLAY_TOKEN_CHARS)
}
