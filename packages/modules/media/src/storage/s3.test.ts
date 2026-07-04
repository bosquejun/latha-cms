import { test } from 'node:test'
import assert from 'node:assert/strict'
import { s3Storage } from './s3.js'

function fakeFetch(handler: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return handler(url, init)
  }) as typeof fetch
  return { calls, restore: () => (globalThis.fetch = original) }
}

test('upload signs a path-style PUT against a custom endpoint and returns the public URL', async () => {
  const { calls, restore } = fakeFetch(() => new Response(null, { status: 200 }))
  try {
    const storage = s3Storage({
      bucket: 'my-bucket',
      region: 'auto',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      endpoint: 'abc123.r2.cloudflarestorage.com',
      publicUrl: 'https://cdn.example.com/',
    })
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })

    const { url, key } = await storage.upload(file)

    assert.equal(calls.length, 1)
    const call = calls[0]!
    assert.equal(call.init.method, 'PUT')
    assert.equal(call.url, `https://abc123.r2.cloudflarestorage.com/my-bucket/${key}`)
    const headers = call.init.headers as Record<string, string>
    assert.match(headers.authorization!, /^AWS4-HMAC-SHA256 Credential=key\//)
    assert.equal(headers['content-type'], 'image/jpeg')
    assert.equal(url, `https://cdn.example.com/${key}`)
    assert.match(key, /^.+-photo\.jpg$/)
  } finally {
    restore()
  }
})

test('upload falls back to the request URL when no publicUrl is configured (AWS-style host)', async () => {
  const { restore } = fakeFetch(() => new Response(null, { status: 200 }))
  try {
    const storage = s3Storage({
      bucket: 'my-bucket',
      region: 'us-east-1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    })
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
    const { url, key } = await storage.upload(file)
    assert.equal(url, `https://my-bucket.s3.us-east-1.amazonaws.com/${key}`)
  } finally {
    restore()
  }
})

test('upload throws with response details when the server rejects the request', async () => {
  const { restore } = fakeFetch(() => new Response('Access Denied', { status: 403, statusText: 'Forbidden' }))
  try {
    const storage = s3Storage({
      bucket: 'my-bucket',
      region: 'us-east-1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    })
    const file = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
    await assert.rejects(() => storage.upload(file), /S3 upload failed: 403.*Access Denied/s)
  } finally {
    restore()
  }
})

test('delete tolerates a 404 (already-gone key)', async () => {
  const { calls, restore } = fakeFetch(() => new Response(null, { status: 404 }))
  try {
    const storage = s3Storage({
      bucket: 'my-bucket',
      region: 'us-east-1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    })
    await storage.delete('some-key') // must not throw
    assert.equal(calls[0]!.init.method, 'DELETE')
  } finally {
    restore()
  }
})

test('delete throws on a real error', async () => {
  const { restore } = fakeFetch(() => new Response('nope', { status: 500, statusText: 'Server Error' }))
  try {
    const storage = s3Storage({
      bucket: 'my-bucket',
      region: 'us-east-1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    })
    await assert.rejects(() => storage.delete('some-key'), /S3 delete failed: 500/)
  } finally {
    restore()
  }
})
