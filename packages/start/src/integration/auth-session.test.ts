/**
 * Session lifecycle across two transports: log in through the module-route
 * dispatcher (`handleModuleRoute` → auth/login), then carry the resulting
 * `kon10_session` cookie into the RPC dispatcher (`handleKon10Request`). Proves
 * every transport authenticates the same principal, that a cookieless RPC call
 * is denied, and that logout clears the cookie. No existing test threads a real
 * login cookie from one handler into another.
 */

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { AccessDeniedError } from '@kon10/core'
import type { ResolvedConfig } from '@kon10/core'
import { handleModuleRoute } from '../module-routes.js'
import { ADMIN_EMAIL, ADMIN_PASSWORD, buildTestConfig, login, memoryAdapter, rpc } from './fixture.js'

let config: ResolvedConfig

const authRequest = (path: string, body?: unknown, headers?: Record<string, string>) =>
  new Request(`http://localhost/__kon10/modules/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

before(() => {
  config = buildTestConfig(memoryAdapter())
})

test('wrong credentials do not set a session cookie', async () => {
  const res = await handleModuleRoute(config, authRequest('login', { email: ADMIN_EMAIL, password: 'nope' }))
  assert.equal(res.headers.get('set-cookie'), null)
  assert.deepEqual(await res.json(), { ok: false, user: null })
})

test('a login cookie authenticates an RPC call; no cookie is denied', async () => {
  const cookie = await login(config, ADMIN_EMAIL, ADMIN_PASSWORD)
  assert.match(cookie, /^kon10_session=/)

  // The same cookie authorizes the Studio-gated RPC surface.
  const sections = await rpc(config, { action: 'nav' }, cookie)
  assert.ok(Array.isArray(sections))

  // Without it, the caller is the anonymous Public principal — no studio:access.
  await assert.rejects(() => rpc(config, { action: 'nav' }), AccessDeniedError)
})

test('current-user reflects the session cookie', async () => {
  const cookie = await login(config, ADMIN_EMAIL, ADMIN_PASSWORD)

  const meRes = await handleModuleRoute(
    config,
    new Request('http://localhost/__kon10/modules/auth/current-user', { headers: { cookie } }),
  )
  const me = (await meRes.json()) as { email: string } | null
  assert.equal(me?.email, ADMIN_EMAIL)

  const anonRes = await handleModuleRoute(
    config,
    new Request('http://localhost/__kon10/modules/auth/current-user'),
  )
  assert.equal(await anonRes.json(), null)
})

test('logout clears the session cookie', async () => {
  const res = await handleModuleRoute(config, authRequest('logout'))
  const setCookie = res.headers.get('set-cookie')
  assert.ok(setCookie)
  assert.match(setCookie!, /Max-Age=0/)
  assert.deepEqual(await res.json(), { ok: true })
})
