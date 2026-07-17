/**
 * First-run setup route coverage, driven exactly as the runner's generic
 * module-route dispatcher calls them.
 *
 * Both routes are public by necessity — a fresh install has nobody to
 * authenticate as — so the guarantees under test are that setup reports itself
 * accurately, refuses to run once the install is non-empty, and (in
 * production) demands the derived token.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapKon10, defineConfig, type Kon10Instance } from '@kon10/core'
import { AuthModule } from '../module.js'
import { getRoleByName } from '../rbac/seed.js'
import { setupToken } from '../setup.js'
import { fakeDb, usersModule } from '../test-support.js'
import { setupRoute, setupStatusRoute } from './setup.js'

const SECRET = 'test-secret'

/** A bootstrapped instance whose subject store is the real entity store. */
function boot(): Promise<Kon10Instance> {
  return bootstrapKon10(
    defineConfig({
      db: fakeDb(),
      modules: [usersModule(), AuthModule({ secret: SECRET })],
    }),
  )
}

/** An instance whose custom store cannot count or create — an external IdP. */
function bootExternalIdp(): Promise<Kon10Instance> {
  return bootstrapKon10(
    defineConfig({
      db: fakeDb(),
      modules: [
        AuthModule({
          secret: SECRET,
          subjectStore: () => ({
            async findByEmail() {
              return null
            },
            async findById() {
              return null
            },
          }),
        }),
      ],
    }),
  )
}

function statusRequest() {
  return new Request('http://localhost/__kon10/modules/auth/setup-status')
}

function setupRequest(body: unknown) {
  return new Request('http://localhost/__kon10/modules/auth/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID = { email: 'admin@example.com', password: 'a-good-long-password', name: 'Admin' }

test('setupStatusRoute reports setup is needed on an empty install', async () => {
  const cms = await boot()
  const res = await setupStatusRoute.handler({ cms, principal: null, request: statusRequest() })
  assert.deepEqual(await res.json(), { supported: true, needsSetup: true })
})

test('setupStatusRoute reports setup is done once a user exists', async () => {
  const cms = await boot()
  await setupRoute.handler({ cms, principal: null, request: setupRequest(VALID) })

  const res = await setupStatusRoute.handler({ cms, principal: null, request: statusRequest() })
  assert.deepEqual(await res.json(), { supported: true, needsSetup: false })
})

test('setupStatusRoute reports unsupported when the store cannot create subjects', async () => {
  const cms = await bootExternalIdp()
  const res = await setupStatusRoute.handler({ cms, principal: null, request: statusRequest() })
  assert.deepEqual(await res.json(), { supported: false, needsSetup: false })
})

test('setupRoute creates the first admin and starts a session', async () => {
  const cms = await boot()
  const res = await setupRoute.handler({ cms, principal: null, request: setupRequest(VALID) })

  const body = (await res.json()) as { ok: boolean; user: { email: string } }
  assert.equal(body.ok, true)
  assert.equal(body.user.email, 'admin@example.com')

  const setCookie = res.headers.get('set-cookie')
  assert.ok(setCookie, 'setup should sign the new admin in')
  assert.match(setCookie!, /^kon10_session=/)
})

test('setupRoute grants the first admin the seeded admin role', async () => {
  const cms = await boot()
  await setupRoute.handler({ cms, principal: null, request: setupRequest(VALID) })

  const adminRole = await getRoleByName(cms, 'admin')
  const created = await cms.db.find('users', { where: { email: 'admin@example.com' } })
  assert.deepEqual((created[0] as unknown as { roles: string[] }).roles, [adminRole!.id])
})

test('setupRoute refuses once the install already has a user', async () => {
  const cms = await boot()
  await setupRoute.handler({ cms, principal: null, request: setupRequest(VALID) })

  const res = await setupRoute.handler({
    cms,
    principal: null,
    request: setupRequest({ ...VALID, email: 'attacker@example.com' }),
  })
  const body = (await res.json()) as { ok: boolean; error?: string }
  assert.equal(body.ok, false)
  assert.match(body.error ?? '', /already/i)
  assert.equal(await cms.db.count('users'), 1)
})

test('setupRoute rejects a malformed email', async () => {
  const cms = await boot()
  const res = await setupRoute.handler({
    cms,
    principal: null,
    request: setupRequest({ ...VALID, email: 'not-an-email' }),
  })
  const body = (await res.json()) as { ok: boolean }
  assert.equal(body.ok, false)
  assert.equal(await cms.db.count('users'), 0)
})

test('setupRoute rejects a password below the minimum length', async () => {
  const cms = await boot()
  const res = await setupRoute.handler({
    cms,
    principal: null,
    request: setupRequest({ ...VALID, password: 'short' }),
  })
  const body = (await res.json()) as { ok: boolean }
  assert.equal(body.ok, false)
  assert.equal(await cms.db.count('users'), 0)
})

/**
 * Run `fn` as if in production. `resolveAuthOptions()` reads the secret from
 * the environment (not from `AuthModule({ secret })`, which is decorative), and
 * throws in production when it is absent — so both vars move together.
 */
async function inProduction(fn: () => Promise<void>): Promise<void> {
  process.env.NODE_ENV = 'production'
  process.env.AUTH_SECRET = SECRET
  try {
    await fn()
  } finally {
    delete process.env.NODE_ENV
    delete process.env.AUTH_SECRET
  }
}

test('setupRoute rejects a request with no token in production', async () => {
  const cms = await boot()
  await inProduction(async () => {
    const res = await setupRoute.handler({ cms, principal: null, request: setupRequest(VALID) })
    const body = (await res.json()) as { ok: boolean; error?: string }
    assert.equal(body.ok, false)
    assert.match(body.error ?? '', /token/i)
    assert.equal(await cms.db.count('users'), 0)
  })
})

test('setupRoute rejects a token derived from the wrong secret in production', async () => {
  const cms = await boot()
  await inProduction(async () => {
    const res = await setupRoute.handler({
      cms,
      principal: null,
      request: setupRequest({ ...VALID, token: await setupToken('not-the-secret') }),
    })
    const body = (await res.json()) as { ok: boolean }
    assert.equal(body.ok, false)
    assert.equal(await cms.db.count('users'), 0)
  })
})

test('setupRoute accepts the derived token in production', async () => {
  const cms = await boot()
  await inProduction(async () => {
    const res = await setupRoute.handler({
      cms,
      principal: null,
      request: setupRequest({ ...VALID, token: await setupToken(SECRET) }),
    })
    const body = (await res.json()) as { ok: boolean }
    assert.equal(body.ok, true)
    assert.equal(await cms.db.count('users'), 1)
  })
})
