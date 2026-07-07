/**
 * Auth-hardening coverage: the login failure throttle's fixed window, and the
 * Origin-based CSRF guard on the cookie-authenticated endpoints.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clearLoginFailures,
  loginBlocked,
  recordLoginFailure,
} from './login-throttle.js'
import { rejectUntrustedOrigin } from './server.js'

test('login throttle blocks after repeated failures and resets on success', () => {
  const email = 'attacker@example.com'
  const t0 = 1_000_000
  for (let i = 0; i < 9; i++) recordLoginFailure(email, t0)
  assert.equal(loginBlocked(email, t0), false)
  recordLoginFailure(email, t0)
  assert.equal(loginBlocked(email, t0), true)
  // Case/whitespace variants hit the same counter.
  assert.equal(loginBlocked('  Attacker@Example.COM ', t0), true)
  clearLoginFailures(email)
  assert.equal(loginBlocked(email, t0), false)
})

test('login throttle window expires', () => {
  const email = 'slow@example.com'
  const t0 = 2_000_000
  for (let i = 0; i < 10; i++) recordLoginFailure(email, t0)
  assert.equal(loginBlocked(email, t0), true)
  const after = t0 + 16 * 60 * 1000
  assert.equal(loginBlocked(email, after), false)
})

test('origin guard rejects cross-origin, passes same-host and missing Origin', () => {
  const req = (origin?: string, headers: Record<string, string> = {}) =>
    new Request('https://cms.example.com/__latha/rpc', {
      method: 'POST',
      headers: { ...(origin ? { origin } : {}), ...headers },
    })

  assert.equal(rejectUntrustedOrigin(req()), null)
  assert.equal(rejectUntrustedOrigin(req('https://cms.example.com')), null)
  // Scheme differences don't matter (TLS-terminating proxy), hosts do.
  assert.equal(rejectUntrustedOrigin(req('http://cms.example.com')), null)

  const cross = rejectUntrustedOrigin(req('https://evil.example.net'))
  assert.equal(cross?.status, 403)
  const malformed = rejectUntrustedOrigin(req('not a url'))
  assert.equal(malformed?.status, 403)

  // Proxied deployments compare against x-forwarded-host.
  const proxied = new Request('http://10.0.0.5:8080/__latha/rpc', {
    method: 'POST',
    headers: { origin: 'https://cms.example.com', 'x-forwarded-host': 'cms.example.com' },
  })
  assert.equal(rejectUntrustedOrigin(proxied), null)
})
