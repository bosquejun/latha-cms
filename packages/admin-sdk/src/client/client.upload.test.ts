import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createKon10Client } from './client.js'

test('upload posts multipart form data to DEFAULT_UPLOAD_PATH', async (t) => {
  const calls: { url: string; body: unknown }[] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body })
    return new Response(JSON.stringify({ id: 'm1', url: '/uploads/x.png' }), { status: 200 })
  })

  const client = createKon10Client()
  const file = new File([new Uint8Array([1])], 'x.png', { type: 'image/png' })
  const doc = await client.upload(file, { alt: 'A cat' })

  assert.equal(doc.id, 'm1')
  assert.equal(calls.length, 1)
  assert.match(calls[0]!.url, /\/__kon10\/modules\/media\/upload$/)
  const form = calls[0]!.body as FormData
  assert.ok(form instanceof FormData)
  assert.equal((form.get('file') as File).name, 'x.png')
  assert.equal(form.get('alt'), 'A cat')
})
