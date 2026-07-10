/**
 * Auth-hardening coverage: the Origin-based CSRF guard on the
 * cookie-authenticated endpoints. (The login failure throttle moved to
 * `@kon10/auth` along with the login/logout/current-user routes themselves —
 * see `login-throttle.test.ts` there.)
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rejectUntrustedOrigin } from './server.js'

test('origin guard rejects cross-origin, passes same-host and missing Origin', () => {
  const req = (origin?: string, headers: Record<string, string> = {}) =>
    new Request('https://cms.example.com/__kon10/rpc', {
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
  const proxied = new Request('http://10.0.0.5:8080/__kon10/rpc', {
    method: 'POST',
    headers: { origin: 'https://cms.example.com', 'x-forwarded-host': 'cms.example.com' },
  })
  assert.equal(rejectUntrustedOrigin(proxied), null)
})
