import assert from 'node:assert/strict'
import { test } from 'node:test'
import { z } from 'zod'
import { createDeliveryClient, DeliveryError } from './client.js'
import { apiSuccess, apiFailure, apiPaginationOf } from './envelope.js'

/** A `fetch` stub that records the last request and returns a fixed envelope. */
function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { fn, calls }
}

const postSchema = z.object({ id: z.string(), title: z.string() })

test('list builds the delivery URL with page/pageSize/sort/where and returns data + pagination', async () => {
  const { fn, calls } = stubFetch(
    200,
    apiSuccess([{ id: '1', title: 'Hello' }], apiPaginationOf(1, 1, 20)),
  )
  const client = createDeliveryClient({ baseUrl: 'https://cms.example.com', fetch: fn })

  const result = await client.list('contents/posts', {
    page: 1,
    pageSize: 20,
    sort: '-createdAt',
    where: { status: 'published' },
    schema: postSchema,
  })

  const url = new URL(calls[0]!.url)
  assert.equal(url.origin + url.pathname, 'https://cms.example.com/api/v1/contents/posts')
  assert.equal(url.searchParams.get('page'), '1')
  assert.equal(url.searchParams.get('pageSize'), '20')
  assert.equal(url.searchParams.get('sort'), '-createdAt')
  assert.equal(url.searchParams.get('where[status]'), 'published')
  assert.deepEqual(result.data, [{ id: '1', title: 'Hello' }])
  assert.equal(result.pagination?.total, 1)
})

test('get returns the document and encodes the id segment', async () => {
  const { fn, calls } = stubFetch(200, apiSuccess({ id: 'a b', title: 'X' }))
  const client = createDeliveryClient({ baseUrl: 'https://cms.example.com/', fetch: fn })

  const doc = await client.get('contents/posts', 'a b', { schema: postSchema })

  assert.ok(calls[0]!.url.endsWith('/api/v1/contents/posts/a%20b'))
  assert.deepEqual(doc, { id: 'a b', title: 'X' })
})

test('get maps a NOT_FOUND / 404 to null', async () => {
  const { fn } = stubFetch(404, apiFailure('NOT_FOUND', 'Not found.'))
  const client = createDeliveryClient({ baseUrl: 'https://cms.example.com', fetch: fn })
  assert.equal(await client.get('contents/posts', 'missing'), null)
})

test('single reads a singleton without a slug id segment', async () => {
  const { fn, calls } = stubFetch(200, apiSuccess({ id: 'settings', siteName: 'Kon10' }))
  const client = createDeliveryClient({ baseUrl: 'https://cms.example.com', fetch: fn })

  await client.single('site/settings')
  const url = new URL(calls[0]!.url)
  assert.equal(url.pathname, '/api/v1/site/settings')
})

test('a non-404 failure envelope throws DeliveryError carrying code and requestId', async () => {
  const { fn } = stubFetch(403, apiFailure('FORBIDDEN', 'Forbidden.', 'req-123'))
  const client = createDeliveryClient({ baseUrl: 'https://cms.example.com', fetch: fn })

  await assert.rejects(client.list('contents/posts'), (err: unknown) => {
    assert.ok(err instanceof DeliveryError)
    assert.equal(err.code, 'FORBIDDEN')
    assert.equal(err.status, 403)
    assert.equal(err.requestId, 'req-123')
    return true
  })
})

test('apiKey is sent as an Authorization bearer header', async () => {
  const { fn, calls } = stubFetch(200, apiSuccess([]))
  const client = createDeliveryClient({
    baseUrl: 'https://cms.example.com',
    apiKey: 'kon10_secret',
    fetch: fn,
  })

  await client.list('media')
  const headers = new Headers(calls[0]!.init!.headers)
  assert.equal(headers.get('authorization'), 'Bearer kon10_secret')
})

test('a custom basePath is honored', async () => {
  const { fn, calls } = stubFetch(200, apiSuccess([]))
  const client = createDeliveryClient({
    baseUrl: 'https://cms.example.com',
    basePath: '/content-api',
    fetch: fn,
  })

  await client.list('contents/posts')
  assert.ok(new URL(calls[0]!.url).pathname.startsWith('/content-api/contents/posts'))
})

test('a malformed (non-envelope) body throws DeliveryError', async () => {
  const { fn } = stubFetch(200, { unexpected: true })
  const client = createDeliveryClient({ baseUrl: 'https://cms.example.com', fetch: fn })
  await assert.rejects(client.list('contents/posts'), (err: unknown) => {
    assert.ok(err instanceof DeliveryError)
    assert.equal(err.code, 'MALFORMED')
    return true
  })
})

test('a secret key passed in a browser context throws; publishable is fine', () => {
  const g = globalThis as { window?: unknown; document?: unknown }
  g.window = {}
  g.document = {}
  const noopFetch = (() => Promise.resolve(new Response('{}'))) as unknown as typeof fetch
  try {
    assert.throws(
      () => createDeliveryClient({ baseUrl: 'https://x', apiKey: 'kon10_sk_secret', fetch: noopFetch }),
      /secret API key/,
    )
    assert.doesNotThrow(() =>
      createDeliveryClient({ baseUrl: 'https://x', apiKey: 'kon10_pk_ok', fetch: noopFetch }),
    )
  } finally {
    delete g.window
    delete g.document
  }
})
