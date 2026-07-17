import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPosthogTelemetry } from './posthog.js'

interface Captured {
  url: string
  body: {
    api_key: string
    batch: Array<{ event: string; distinct_id: string; properties: Record<string, unknown> }>
  }
}

async function withFetchStub(run: (calls: Captured[]) => Promise<void>) {
  const calls: Captured[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string, init: { body: string }) => {
    calls.push({ url, body: JSON.parse(init.body) })
    return new Response('{}', { status: 200 })
  }) as unknown as typeof fetch
  try {
    await run(calls)
  } finally {
    globalThis.fetch = original
  }
}

test('flush POSTs a batch to PostHog with the api key and distinct id', async () => {
  await withFetchStub(async (calls) => {
    const t = createPosthogTelemetry({
      apiKey: 'phc_test',
      host: 'https://us.i.posthog.com',
      distinctId: 'anon-1',
      commonProperties: { app: 'demo' },
    })
    t.capture({ name: 'kon10_boot', properties: { node: 'v20', drop: undefined } })
    await t.flush()

    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.url, 'https://us.i.posthog.com/batch/')
    assert.equal(calls[0]!.body.api_key, 'phc_test')
    const event = calls[0]!.body.batch[0]!
    assert.equal(event.event, 'kon10_boot')
    assert.equal(event.distinct_id, 'anon-1')
    assert.equal(event.properties.node, 'v20')
    assert.equal(event.properties.app, 'demo')
    // `undefined` properties are dropped from the payload.
    assert.ok(!('drop' in event.properties))
  })
})

test('flush with an empty queue makes no request', async () => {
  await withFetchStub(async (calls) => {
    const t = createPosthogTelemetry({ apiKey: 'k', host: 'https://h', distinctId: 'd' })
    await t.flush()
    assert.equal(calls.length, 0)
  })
})
