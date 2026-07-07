/**
 * Login/logout/current-user route coverage: a real bootstrapped `AuthModule`
 * instance (custom subject store, no `@latha/users` needed) exercised through
 * the declared `ModuleRoute`s exactly as the runner's generic module-route
 * dispatcher calls them. Unlike `@latha/start`'s cookie-reading (which relies
 * on TanStack's ambient request context), these routes take the `Cookie`
 * header straight off the `Request` they're given, so they're fully testable
 * here with plain `node:test`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bootstrapLatha,
  defineConfig,
  type DBAdapter,
  type Doc,
  type LathaInstance,
  type Query,
} from '@latha/core'
import { AuthModule } from '../module.js'
import { hashPassword } from '../crypto.js'
import { loginRoute } from './login.js'
import { logoutRoute } from './logout.js'
import { currentUserRoute } from './current-user.js'
import { loginBlocked, clearLoginFailures } from '../login-throttle.js'

function fakeDb(): DBAdapter {
  const tables = new Map<string, Map<string, Doc>>()
  let seq = 0
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
      const doc = { id: `r${++seq}`, ...data } as Doc
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

const ALICE_PASSWORD = 'correct-horse-battery-staple'
const alicePasswordHash = await hashPassword(ALICE_PASSWORD)
const subjects = new Map([
  ['u1', { id: 'u1', email: 'alice@example.com', passwordHash: alicePasswordHash, roles: [] }],
])

async function bootAuth(): Promise<LathaInstance> {
  const config = defineConfig({
    db: fakeDb(),
    modules: [
      AuthModule({
        secret: 'test-secret',
        subjectStore: () => ({
          async findByEmail(email) {
            return [...subjects.values()].find((s) => s.email === email) ?? null
          },
          async findById(id) {
            return subjects.get(id) ?? null
          },
        }),
      }),
    ],
  })
  return bootstrapLatha(config)
}

const cms = await bootAuth()

function jsonRequest(path: string, body: unknown, headers?: Record<string, string>) {
  return new Request(`http://localhost/__latha/modules/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/** Pull just the `name=value` pair back out of a `Set-Cookie` header. */
function cookiePair(setCookie: string): string {
  return setCookie.split(';')[0]!
}

test('loginRoute rejects an unknown email without setting a cookie', async () => {
  const res = await loginRoute.handler({
    cms,
    principal: null,
    request: jsonRequest('login', { email: 'nobody@example.com', password: 'whatever' }),
  })
  assert.equal(res.headers.get('set-cookie'), null)
  assert.deepEqual(await res.json(), { ok: false, user: null })
})

test('loginRoute rejects the wrong password', async () => {
  clearLoginFailures('alice@example.com')
  const res = await loginRoute.handler({
    cms,
    principal: null,
    request: jsonRequest('login', { email: 'alice@example.com', password: 'wrong' }),
  })
  assert.deepEqual(await res.json(), { ok: false, user: null })
})

test('loginRoute succeeds with the right credentials and sets a session cookie', async () => {
  clearLoginFailures('alice@example.com')
  const res = await loginRoute.handler({
    cms,
    principal: null,
    request: jsonRequest('login', { email: 'alice@example.com', password: ALICE_PASSWORD }),
  })
  const setCookie = res.headers.get('set-cookie')
  assert.ok(setCookie)
  assert.match(setCookie!, /^latha_session=/)

  const body = (await res.json()) as { ok: boolean; user: { email: string } }
  assert.equal(body.ok, true)
  assert.equal(body.user.email, 'alice@example.com')

  // Round-trip: the cookie login just set authenticates current-user.
  const meReq = new Request('http://localhost/__latha/modules/auth/current-user', {
    headers: { cookie: cookiePair(setCookie!) },
  })
  const meRes = await currentUserRoute.handler({ cms, principal: null, request: meReq })
  const me = (await meRes.json()) as { email: string } | null
  assert.equal(me?.email, 'alice@example.com')
})

test('currentUserRoute returns null with no session cookie', async () => {
  const res = await currentUserRoute.handler({
    cms,
    principal: null,
    request: new Request('http://localhost/__latha/modules/auth/current-user'),
  })
  assert.equal(await res.json(), null)
})

test('logoutRoute clears the session cookie', async () => {
  const res = await logoutRoute.handler({
    cms,
    principal: null,
    request: new Request('http://localhost/__latha/modules/auth/logout', { method: 'POST' }),
  })
  const setCookie = res.headers.get('set-cookie')
  assert.ok(setCookie)
  assert.match(setCookie!, /Max-Age=0/)
  assert.deepEqual(await res.json(), { ok: true })
})

test('the login throttle blocks repeated failures for the same email', async () => {
  const email = 'throttled@example.com'
  clearLoginFailures(email)
  for (let i = 0; i < 10; i++) {
    const res = await loginRoute.handler({
      cms,
      principal: null,
      request: jsonRequest('login', { email, password: 'wrong' }),
    })
    assert.deepEqual(await res.json(), { ok: false, user: null })
  }
  assert.equal(loginBlocked(email), true)

  const blocked = await loginRoute.handler({
    cms,
    principal: null,
    request: jsonRequest('login', { email, password: 'wrong' }),
  })
  const body = (await blocked.json()) as { ok: boolean; error?: string }
  assert.equal(body.ok, false)
  assert.match(body.error ?? '', /Too many failed attempts/)
  clearLoginFailures(email)
})
