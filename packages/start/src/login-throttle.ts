/**
 * Login throttle — a fixed-window failure counter per email.
 *
 * After MAX_FAILURES failed attempts within the window, further attempts for
 * that email are refused until the window expires; a successful login clears
 * the counter. In-memory and per-process: on serverless platforms each
 * instance counts separately, so this is a brute-force speed bump, not a
 * global guarantee — put a real rate limiter in front for hard limits.
 */

const MAX_FAILURES = 10
const WINDOW_MS = 15 * 60 * 1000

interface FailureWindow {
  count: number
  resetAt: number
}

const failures = new Map<string, FailureWindow>()

function keyFor(email: string): string {
  return email.trim().toLowerCase()
}

/** Whether login attempts for this email are currently refused. */
export function loginBlocked(email: string, now = Date.now()): boolean {
  const entry = failures.get(keyFor(email))
  if (!entry) return false
  if (entry.resetAt <= now) {
    failures.delete(keyFor(email))
    return false
  }
  return entry.count >= MAX_FAILURES
}

/** Record a failed attempt for this email. */
export function recordLoginFailure(email: string, now = Date.now()): void {
  const key = keyFor(email)
  const entry = failures.get(key)
  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  entry.count += 1
}

/** Clear the failure counter (successful login). */
export function clearLoginFailures(email: string): void {
  failures.delete(keyFor(email))
}
