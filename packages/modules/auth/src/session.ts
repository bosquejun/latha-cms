/**
 * Stateless session tokens: `<payloadB64Url>.<hmacB64Url>`.
 *
 * The payload is a small JSON object (subject id, role, expiry). It is signed —
 * not encrypted — so it must not carry secrets; it carries only the user id and
 * role, which the server re-validates against the database on each request.
 */

import { fromBase64Url, hmacSign, timingSafeEqual, toBase64Url } from './crypto.js'

export interface SessionPayload {
  /** User id. */
  sub: string
  role?: string
  /** Expiry, epoch seconds. */
  exp: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

/** Create a signed session token for `payload` (minus `exp`, which is derived). */
export async function createSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  secret: string,
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = toBase64Url(encoder.encode(JSON.stringify(full)))
  const sig = toBase64Url(await hmacSign(body, secret))
  return `${body}.${sig}`
}

/** Verify a token's signature and expiry. Returns the payload or `null`. */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  const expectedSig = toBase64Url(await hmacSign(body, secret))
  if (!timingSafeEqual(sig, expectedSig)) return null

  let payload: SessionPayload
  try {
    payload = JSON.parse(decoder.decode(fromBase64Url(body))) as SessionPayload
  } catch {
    return null
  }

  if (typeof payload.sub !== 'string') return null
  if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) {
    return null
  }
  return payload
}
