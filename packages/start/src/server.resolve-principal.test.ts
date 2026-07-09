/**
 * `resolvePrincipal` coverage: anonymous requests resolve to the Public
 * principal, and a valid session cookie resolves to the actual user.
 * `getSessionUser` (from `@latha/auth`) reads the `Cookie` header straight off
 * the `Request` it's given — no framework-specific ambient request context
 * needed, so this runs under plain `node:test`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bootstrapLatha,
  defineConfig,
  operations,
  stampFields,
  text,
  type CacheAdapter,
  type DBAdapter,
  type Doc,
  type Entity,
  type JsonValue,
  type LathaInstance,
  type Query,
} from '@latha/core'
import { AuthModule, createSessionToken, resolveAuthOptions } from '@latha/auth'
import { CacheModule } from '@latha/cache'
import { resolvePrincipal } from './server.js'

function fakeDb(): DBAdapter {
  const tables = new Map<string, Map<string, Doc>>()
  const table = (slug: string) => {
    let t = tables.get(slug)
    if (!t) tables.set(slug, (t = new Map()))
    return t
  }
  const matches = (doc: Doc, where?: Record<string, unknown>) =>
    Object.entries(where ?? {}).every(([k, v]) => doc[k] === v)

  return {
    async find(slug: string, query?: Query) {
      return [...table(slug).values()].filter((d) => matches(d, query?.where))
    },
    async findOne(slug: string, id: string) {
      return table(slug).get(id) ?? null
    },
    async count(slug: string, query?: Query) {
      return [...table(slug).values()].filter((d) => matches(d, query?.where)).length
    },
    async create(slug: string, data: Record<string, unknown>) {
      const doc = { id: (data.id as string) ?? `r${table(slug).size + 1}`, ...data } as Doc
      table(slug).set(doc.id, doc)
      return doc
    },
    async update(slug: string, id: string, data: Record<string, unknown>) {
      const doc = { ...table(slug).get(id)!, ...data } as Doc
      table(slug).set(id, doc)
      return doc
    },
    async delete(slug: string, id: string) {
      table(slug).delete(id)
    },
    async migrate() {},
  }
}

async function bootAuth(): Promise<LathaInstance> {
  const config = defineConfig({
    db: fakeDb(),
    modules: [
      AuthModule({
        secret: 'test-secret',
        subjectStore: () => ({
          async findByEmail() {
            return null
          },
          async findById(id) {
            return id === 'u1' ? { id: 'u1', email: 'alice@example.com', roles: [] } : null
          },
        }),
      }),
    ],
  })
  return bootstrapLatha(config)
}

const cms = await bootAuth()

test('resolvePrincipal resolves the anonymous Public principal with no session cookie', async () => {
  const { sessionUser, principal } = await resolvePrincipal(
    cms,
    new Request('http://localhost/__latha/rpc'),
  )
  assert.equal(sessionUser, null)
  assert.equal((principal as { id: string }).id, '__public__')
})

test('resolvePrincipal resolves the signed-in user from a valid session cookie', async () => {
  const opts = resolveAuthOptions()
  const token = await createSessionToken({ sub: 'u1' }, opts.secret, opts.sessionTtlSeconds)
  const request = new Request('http://localhost/__latha/rpc', {
    headers: { cookie: `${opts.cookieName}=${token}` },
  })

  const { sessionUser, principal } = await resolvePrincipal(cms, request)
  assert.equal(sessionUser?.email, 'alice@example.com')
  assert.equal((principal as { id: string }).id, 'u1')
})

test('resolvePrincipal ignores an invalid session cookie (falls back to Public)', async () => {
  const request = new Request('http://localhost/__latha/rpc', {
    headers: { cookie: 'latha_session=garbage' },
  })
  const { sessionUser, principal } = await resolvePrincipal(cms, request)
  assert.equal(sessionUser, null)
  assert.equal((principal as { id: string }).id, '__public__')
})

// --- Session/user-lookup caching (the entity-backed subject store) ---------

function spyCache(): CacheAdapter & { setKeys: string[] } {
  const store = new Map<string, JsonValue>()
  return {
    setKeys: [],
    async get(key: string) {
      return store.get(key)
    },
    async set(key: string, value: JsonValue) {
      this.setKeys.push(key)
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
    async has(key: string) {
      return store.has(key)
    },
  }
}

const usersEntity: Entity = {
  cardinality: 'many',
  slug: 'users',
  actions: ['read', 'update'],
  fields: stampFields({ email: text({ required: true }) }),
}

async function bootAuthWithCache(cache: CacheAdapter): Promise<LathaInstance> {
  const config = defineConfig({
    db: fakeDb(),
    modules: [
      { name: 'users', entities: [usersEntity] },
      AuthModule({ secret: 'test-secret' }), // default entity-backed store (usersSlug: 'users')
      CacheModule({ cache }),
    ],
  })
  return bootstrapLatha(config)
}

const systemCtx = (cms: LathaInstance) => ({
  cms,
  principal: { id: '__system__', permissions: ['*'] },
})

test('a session resolves the user from cache on the second request', async () => {
  const cache = spyCache()
  const cachedCms = await bootAuthWithCache(cache)
  await cachedCms.db.create('users', { id: 'u1', email: 'alice@example.com', roles: [] })

  const opts = resolveAuthOptions()
  const token = await createSessionToken({ sub: 'u1' }, opts.secret, opts.sessionTtlSeconds)
  const request = new Request('http://localhost/__latha/rpc', {
    headers: { cookie: `${opts.cookieName}=${token}` },
  })

  await resolvePrincipal(cachedCms, request)
  // The user doc and the implicit Authenticated-role lookup each get their
  // own cache entry (see `resolveUserPermissions`).
  assert.deepEqual(new Set(cache.setKeys), new Set(['auth:user:users:u1', 'auth:role:name:authenticated']))

  const setCallsAfterFirst = cache.setKeys.length
  await resolvePrincipal(cachedCms, request)
  assert.equal(cache.setKeys.length, setCallsAfterFirst, 'second resolution served entirely from cache')
})

test('updating the user invalidates the cached session lookup immediately', async () => {
  const cache = spyCache()
  const cachedCms = await bootAuthWithCache(cache)
  await cachedCms.db.create('users', { id: 'u1', email: 'alice@example.com', roles: [] })

  const opts = resolveAuthOptions()
  const token = await createSessionToken({ sub: 'u1' }, opts.secret, opts.sessionTtlSeconds)
  const request = new Request('http://localhost/__latha/rpc', {
    headers: { cookie: `${opts.cookieName}=${token}` },
  })

  const first = await resolvePrincipal(cachedCms, request)
  assert.equal(first.sessionUser?.email, 'alice@example.com')

  await operations.update(systemCtx(cachedCms), 'users', 'u1', { email: 'alice2@example.com' })

  const second = await resolvePrincipal(cachedCms, request)
  assert.equal(
    second.sessionUser?.email,
    'alice2@example.com',
    'reflects the update immediately, not stale-until-TTL',
  )
})
