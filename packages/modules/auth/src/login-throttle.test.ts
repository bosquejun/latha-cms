import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearLoginFailures, loginBlocked, recordLoginFailure } from './login-throttle.js'

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
