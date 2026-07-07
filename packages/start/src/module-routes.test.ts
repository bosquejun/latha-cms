/**
 * Only the routing-table half of `handleModuleRoute` (unknown module/path,
 * wrong method) is covered here: those return before touching the caller's
 * principal. The `requireAdmin` gate and successful dispatch both go through
 * `resolvePrincipal` → `getCookie`, which requires a live TanStack request
 * context (`AsyncLocalStorage`) that plain `node:test` doesn't provide — the
 * same constraint that keeps `server.resolve-principal.test.ts` trivial.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Module, ModuleRoute, ResolvedConfig } from '@latha/core'
import { handleModuleRoute, DEFAULT_MODULE_ROUTES_PATH } from './module-routes.js'

const echoRoute: ModuleRoute = {
  method: 'POST',
  handler: async ({ request }) => Response.json({ body: await request.text() }),
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
    adminPath: '/admin',
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
