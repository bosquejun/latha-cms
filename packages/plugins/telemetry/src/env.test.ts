import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTelemetryDisabled } from './env.js'

test('telemetry is enabled by default (opt-out)', () => {
  assert.equal(isTelemetryDisabled({}), false)
})

test('KON10_DISABLE_TELEMETRY and DO_NOT_TRACK disable it', () => {
  assert.equal(isTelemetryDisabled({ KON10_DISABLE_TELEMETRY: '1' }), true)
  assert.equal(isTelemetryDisabled({ DO_NOT_TRACK: 'true' }), true)
})

test('CI and NODE_ENV=test disable it', () => {
  assert.equal(isTelemetryDisabled({ CI: 'true' }), true)
  assert.equal(isTelemetryDisabled({ NODE_ENV: 'test' }), true)
})

test('falsy-looking values do not disable it', () => {
  assert.equal(isTelemetryDisabled({ KON10_DISABLE_TELEMETRY: '0' }), false)
  assert.equal(isTelemetryDisabled({ DO_NOT_TRACK: 'false' }), false)
  assert.equal(isTelemetryDisabled({ KON10_DISABLE_TELEMETRY: '' }), false)
})
