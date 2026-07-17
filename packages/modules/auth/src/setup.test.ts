/**
 * First-run setup token coverage.
 *
 * The token is derived from `AUTH_SECRET` rather than stored, so every
 * serverless instance agrees on it without shared state and it needs no env
 * var of its own. It gates `POST auth/setup` in production, closing the window
 * where an unattended public deploy could be claimed by whoever finds it first.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setupToken, verifySetupToken } from './setup.js'

test('verifySetupToken accepts the token derived from the same secret', async () => {
  const token = await setupToken('s3cret')
  assert.equal(await verifySetupToken(token, 's3cret'), true)
})

test('verifySetupToken rejects a token derived from a different secret', async () => {
  const token = await setupToken('a-different-secret')
  assert.equal(await verifySetupToken(token, 's3cret'), false)
})

test('verifySetupToken rejects a missing token', async () => {
  assert.equal(await verifySetupToken(undefined, 's3cret'), false)
  assert.equal(await verifySetupToken('', 's3cret'), false)
})

test('setupToken is stable across calls so every instance derives the same value', async () => {
  assert.equal(await setupToken('s3cret'), await setupToken('s3cret'))
})
