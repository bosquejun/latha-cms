/**
 * Edge-friendly crypto built on the Web Crypto API (no native deps).
 *
 * - Passwords: PBKDF2-HMAC-SHA-256 with a random per-password salt.
 * - Sessions: HMAC-SHA-256 signed tokens.
 *
 * Works identically on Node 20+ and serverless/edge runtimes.
 */

const PBKDF2_ITERATIONS = 600_000
const KEY_LENGTH_BITS = 256

const textEncoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  return fromBase64(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
}

/** Constant-time string comparison — iterates maxLen to avoid length leaks. */
export function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length)
  let mismatch = 0
  for (let i = 0; i < maxLen; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return mismatch === 0 && a.length === b.length
}

async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_LENGTH_BITS,
  )
  return new Uint8Array(bits)
}

/** Hash a password → `pbkdf2$<iterations>$<saltB64>$<hashB64>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

/** Verify a password against a stored hash produced by {@link hashPassword}. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations)) return false
  const salt = fromBase64(parts[2]!)
  const expected = parts[3]!
  const actual = toBase64(await pbkdf2(password, salt, iterations))
  return timingSafeEqual(actual, expected)
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

export async function hmacSign(
  data: string,
  secret: string,
): Promise<Uint8Array> {
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(data) as BufferSource,
  )
  return new Uint8Array(sig)
}
