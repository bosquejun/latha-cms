import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createKon10Client } from './client.js'

test('login posts JSON to the auth module route, not the RPC action envelope', async (t) => {
  const calls: { url: string; init: RequestInit }[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ ok: true, user: { id: 'u1' } }), { status: 200 })
  })

  const client = createKon10Client()
  const result = await client.login('alice@example.com', 'secret')

  assert.equal(result.ok, true)
  assert.equal(calls.length, 1)
  assert.match(calls[0]!.url, /\/__kon10\/modules\/auth\/login$/)
  const body = JSON.parse(calls[0]!.init.body as string) as { email: string; password: string }
  assert.deepEqual(body, { email: 'alice@example.com', password: 'secret' })
})

test('logout POSTs to the auth module route', async (t) => {
  const calls: { url: string; init: RequestInit }[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  })

  const client = createKon10Client()
  await client.logout()

  assert.equal(calls.length, 1)
  assert.match(calls[0]!.url, /\/__kon10\/modules\/auth\/logout$/)
  assert.equal(calls[0]!.init.method, 'POST')
})

test('currentUser GETs the auth module route', async (t) => {
  const calls: { url: string; init: RequestInit }[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(null), { status: 200 })
  })

  const client = createKon10Client()
  const user = await client.currentUser()

  assert.equal(user, null)
  assert.equal(calls.length, 1)
  assert.match(calls[0]!.url, /\/__kon10\/modules\/auth\/current-user$/)
  assert.equal(calls[0]!.init.method, 'GET')
})

test('login/logout/currentUser throw with a custom serverFn transport', async () => {
  const client = createKon10Client({ serverFn: async () => ({}) })
  await assert.rejects(() => client.login('a@b.com', 'x'), /default fetch transport/)
  await assert.rejects(() => client.logout(), /default fetch transport/)
  await assert.rejects(() => client.currentUser(), /default fetch transport/)
})

test('setupStatus GETs the auth module route', async (t) => {
  const calls: { url: string; init: RequestInit }[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(
      JSON.stringify({ supported: true, needsSetup: true, tokenRequired: false }),
      { status: 200 },
    )
  })

  const client = createKon10Client()
  const status = await client.setupStatus()

  assert.deepEqual(status, { supported: true, needsSetup: true, tokenRequired: false })
  assert.equal(calls.length, 1)
  assert.match(calls[0]!.url, /\/__kon10\/modules\/auth\/setup-status$/)
  assert.equal(calls[0]!.init.method, 'GET')
})

test('setup posts the admin details to the auth module route', async (t) => {
  const calls: { url: string; init: RequestInit }[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ ok: true, user: { id: 'u1' } }), { status: 200 })
  })

  const client = createKon10Client()
  const result = await client.setup({
    email: 'admin@example.com',
    password: 'a-good-long-password',
    name: 'Admin',
    token: 'tok',
  })

  assert.equal(result.ok, true)
  assert.match(calls[0]!.url, /\/__kon10\/modules\/auth\/setup$/)
  assert.equal(calls[0]!.init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), {
    email: 'admin@example.com',
    password: 'a-good-long-password',
    name: 'Admin',
    token: 'tok',
  })
})

test('setupStatus reports a needsSetup=false install without throwing', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    return new Response(
      JSON.stringify({ supported: true, needsSetup: false, tokenRequired: false }),
      { status: 200 },
    )
  })

  const client = createKon10Client()
  assert.deepEqual(await client.setupStatus(), {
    supported: true,
    needsSetup: false,
    tokenRequired: false,
  })
})
