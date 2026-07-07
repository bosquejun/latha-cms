/**
 * `Set-Cookie` header serialization. The login/logout routes build this
 * header directly on the `Response` they return — no framework-specific
 * cookie helper needed, just the Fetch API both sides already speak.
 */

export interface SetCookieOptions {
  path?: string
  /** Seconds until expiry. `0` clears the cookie immediately. */
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Build one `Set-Cookie` header value. */
export function serializeSetCookie(
  name: string,
  value: string,
  opts: SetCookieOptions = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (opts.path) parts.push(`Path=${opts.path}`)
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.secure) parts.push('Secure')
  if (opts.sameSite) parts.push(`SameSite=${capitalize(opts.sameSite)}`)
  return parts.join('; ')
}
