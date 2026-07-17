import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseTelemetryConsent, shouldCaptureStudioTelemetry } from './server.js'

test('parseTelemetryConsent treats missing and unknown values as unset', () => {
  assert.equal(parseTelemetryConsent(undefined), 'unset')
  assert.equal(parseTelemetryConsent('unknown'), 'unset')
  assert.equal(parseTelemetryConsent('granted'), 'granted')
  assert.equal(parseTelemetryConsent('denied'), 'denied')
})

test('notice and opt-out modes collect until the user denies consent', () => {
  for (const mode of ['notice', 'opt-out'] as const) {
    assert.equal(shouldCaptureStudioTelemetry(mode, 'unset'), true)
    assert.equal(shouldCaptureStudioTelemetry(mode, 'granted'), true)
    assert.equal(shouldCaptureStudioTelemetry(mode, 'denied'), false)
  }
})

test('opt-in mode requires an explicit grant', () => {
  assert.equal(shouldCaptureStudioTelemetry('opt-in', 'unset'), false)
  assert.equal(shouldCaptureStudioTelemetry('opt-in', 'granted'), true)
  assert.equal(shouldCaptureStudioTelemetry('opt-in', 'denied'), false)
})
