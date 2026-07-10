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
