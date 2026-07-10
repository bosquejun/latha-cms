/**
 * `handleModuleRoute` coverage: routing-table lookups (unknown module/path,
 * wrong method), the `requireStudioAccess` gate, successful dispatch, and error
 * mapping. `resolvePrincipal` takes `request` explicitly and reads the
 * `Cookie` header straight off it (via `@kon10/auth`'s `getSessionUser`) — no
 * framework-specific ambient request context needed, so all of this runs
 * under plain `node:test`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Module, ModuleRoute, ResolvedConfig } from '@kon10/core'
import { handleModuleRoute, DEFAULT_MODULE_ROUTES_PATH } from './module-routes.js'

const echoRoute: ModuleRoute = {
  method: 'POST',
  handler: async ({ request }) => Response.json({ body: await request.text() }),
}

const studioOnlyRoute: ModuleRoute = {
  method: 'POST',
  requireStudioAccess: true,
  handler: async () => Response.json({ ok: true }),
}

const throwingRoute: ModuleRoute = {
  method: 'POST',
  handler: async () => {
    throw new Error('nope')
  },
}

function fakeConfig(modules: Module[]): ResolvedConfig {
  return {
    db: {
      find: async () => [],
      findOne: async () => null,
      count: async () => 0,
      create: async (_slug: string, d: Record<string, unknown>) => ({ id: '1', ...d }),
      update: async (_slug: string, id: string, d: Record<string, unknown>) => ({ id, ...d }),
      delete: async () => {},
      migrate: async () => {},
    },
    modules,
    plugins: [],
    studioPath: '/studio',
  } as unknown as ResolvedConfig
}

function request(path: string, method = 'POST', body?: string) {
  return new Request(`http://localhost${DEFAULT_MODULE_ROUTES_PATH}${path}`, { method, body })
}

test('handleModuleRoute 404s for an unknown module', async () => {
  const res = await handleModuleRoute(fakeConfig([]), request('/nope/echo'))
  assert.equal(res.status, 404)
})

test('handleModuleRoute 404s for a module without that path', async () => {
  const mod: Module = { name: 'demo', routes: { echo: echoRoute } }
  const res = await handleModuleRoute(fakeConfig([mod]), request('/demo/missing'))
  assert.equal(res.status, 404)
})

test('handleModuleRoute 405s when the path exists but not for that method', async () => {
  const mod: Module = { name: 'demo', routes: { echo: echoRoute } }
  const res = await handleModuleRoute(fakeConfig([mod]), request('/demo/echo', 'DELETE'))
  assert.equal(res.status, 405)
})

test('handleModuleRoute dispatches to the module handler on a match', async () => {
  const mod: Module = { name: 'demo', routes: { echo: echoRoute } }
  const res = await handleModuleRoute(fakeConfig([mod]), request('/demo/echo', 'POST', 'hi'))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { body: 'hi' })
})

test('handleModuleRoute rejects requireStudioAccess routes for an unauthenticated caller', async () => {
  const mod: Module = { name: 'demo', routes: { secure: studioOnlyRoute } }
  const res = await handleModuleRoute(fakeConfig([mod]), request('/demo/secure'))
  assert.equal(res.status, 403)
})

test('handleModuleRoute turns a handler throw into a 400', async () => {
  const mod: Module = { name: 'demo', routes: { boom: throwingRoute } }
  const res = await handleModuleRoute(fakeConfig([mod]), request('/demo/boom'))
  assert.equal(res.status, 400)
  assert.deepEqual(await res.json(), { error: 'nope' })
})
