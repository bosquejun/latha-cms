import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePrincipal } from './server.js'

test('resolvePrincipal is exported', () => {
  assert.equal(typeof resolvePrincipal, 'function')
})
