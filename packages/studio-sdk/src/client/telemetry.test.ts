import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { syncTelemetryPreferences } from './telemetry.js'

const originalLocalStorage = globalThis.localStorage
const originalDocument = globalThis.document

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalLocalStorage })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
})

test('syncTelemetryPreferences replaces stale cookies with the current user preferences', () => {
  const values = new Map<string, string>([
    ['kon10-telemetry-consent:user-b', 'granted'],
    ['kon10-telemetry-anon:user-b', '1'],
  ])
  const cookies: string[] = []
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => values.get(key) ?? null },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { set cookie(value: string) { cookies.push(value) } },
  })

  assert.deepEqual(syncTelemetryPreferences('user-b'), {
    status: 'granted',
    anonymous: true,
  })
  assert.match(cookies[0]!, /^kon10_tm_consent=granted;/)
  assert.match(cookies[1]!, /^kon10_tm_anon=1;/)
})

test('syncTelemetryPreferences writes explicit defaults for a new user', () => {
  const cookies: string[] = []
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { set cookie(value: string) { cookies.push(value) } },
  })

  assert.deepEqual(syncTelemetryPreferences('new-user'), {
    status: 'unset',
    anonymous: false,
  })
  assert.match(cookies[0]!, /^kon10_tm_consent=unset;/)
  assert.match(cookies[1]!, /^kon10_tm_anon=0;/)
})
