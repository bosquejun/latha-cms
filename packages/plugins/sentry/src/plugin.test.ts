import assert from 'node:assert/strict'
import { test } from 'node:test'

import { silentLogger } from '@kon10/core'
import type { Kon10Instance } from '@kon10/core'
import { sentryTracingPlugin, sentryTracingPluginOptionsSchema } from './plugin.js'

function fakeCms() {
  let registered: Kon10Instance['tracer'] | undefined
  const cms = {
    logger: silentLogger,
    registerTracer(tracer: Kon10Instance['tracer']) {
      registered = tracer
    },
  } as unknown as Kon10Instance
  return { cms, getTracer: () => registered }
}

test('sentryTracingPluginOptionsSchema accepts a valid config and rejects an out-of-range sample rate', () => {
  assert.deepEqual(
    sentryTracingPluginOptionsSchema.parse({ dsn: 'https://x@sentry.io/1', tracesSampleRate: 0.5 }),
    { dsn: 'https://x@sentry.io/1', tracesSampleRate: 0.5 },
  )
  assert.throws(() => sentryTracingPluginOptionsSchema.parse({ tracesSampleRate: 2 }))
})

test('the plugin is named "sentry"', () => {
  assert.equal(sentryTracingPlugin({ autoInit: false }).name, 'sentry')
})

test('onInit with autoInit: false skips Sentry.init and registers a Tracer', async () => {
  const { cms, getTracer } = fakeCms()
  await sentryTracingPlugin({ autoInit: false }).onInit?.(cms)

  const tracer = getTracer()
  assert.ok(tracer, 'registerTracer was called')

  const result = tracer!.startActiveSpan('kon10.find', (span) => {
    span.setAttribute('kon10.entity', 'posts').setAttributes({ 'kon10.operation': 'read' })
    span.setStatus({ code: 1 })
    span.recordException(new Error('ignored — no real backend without Sentry.init'))
    span.end()
    return 'span ran'
  })
  assert.equal(result, 'span ran')
})
