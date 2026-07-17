/**
 * First-run setup — the token that gates creating the very first admin.
 *
 * A fresh install has no users, so `POST auth/setup` cannot authenticate the
 * caller: anyone who reaches it while the install is empty becomes the admin.
 * In development that is exactly what you want (zero friction). In production
 * it would mean an unattended public deploy stays claimable by whoever finds
 * the URL first, so setup additionally requires a token.
 *
 * The token is *derived* from `AUTH_SECRET` (HMAC), not stored and not a new
 * env var:
 *   - every serverless instance derives the same value with no shared state,
 *     so it survives cold starts;
 *   - it needs no extra configuration beyond the secret production already
 *     requires;
 *   - it is inert the moment a user exists, since the route refuses to run at
 *     all once the install is non-empty.
 *
 * Holders of `AUTH_SECRET` can derive it themselves — see the README — which is
 * the same trust boundary that already lets them mint session tokens.
 */

import { hmacSign, timingSafeEqual, toBase64Url } from './crypto.js'

// Avoid a hard @types/node dependency for one env var.
declare const process: { env: Record<string, string | undefined> }

/** Domain-separates this HMAC from session-token signing under the same secret. */
const SETUP_TOKEN_CONTEXT = 'kon10:setup'

/** Derive the setup token for a secret. Deterministic. */
export async function setupToken(secret: string): Promise<string> {
  return toBase64Url(await hmacSign(SETUP_TOKEN_CONTEXT, secret))
}

/** Constant-time check of a caller-supplied token against the derived one. */
export async function verifySetupToken(
  provided: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!provided) return false
  return timingSafeEqual(provided, await setupToken(secret))
}

/**
 * Whether `POST auth/setup` demands a token. Production only — development
 * keeps first-run setup frictionless.
 */
export function setupTokenRequired(): boolean {
  return process.env['NODE_ENV'] === 'production'
}
