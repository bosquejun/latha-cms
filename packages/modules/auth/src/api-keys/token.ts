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

export const API_KEY_TOKEN_PREFIX = 'kon10_'

/** `kon10_` + 8 token chars — enough to identify a key in a list. */
const DISPLAY_PREFIX_LENGTH = API_KEY_TOKEN_PREFIX.length + 8

const textEncoder = new TextEncoder()

/** Generate a fresh API key token: `kon10_<base64url(32 random bytes)>`. */
export function generateApiKeyToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return API_KEY_TOKEN_PREFIX + toBase64Url(bytes)
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

/** The identifying prefix persisted alongside the hash (e.g. `kon10_Ab12Cd34`). */
export function apiKeyDisplayPrefix(token: string): string {
  return token.slice(0, DISPLAY_PREFIX_LENGTH)
}
