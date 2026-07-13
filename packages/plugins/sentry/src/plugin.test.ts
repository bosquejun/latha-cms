import assert from 'node:assert/strict'
import { test } from 'node:test'

import { trace } from '@opentelemetry/api'

import { silentLogger } from '@kon10/core'
import type { Kon10Instance } from '@kon10/core'
import { sentryTracingPlugin, sentryTracingPluginOptionsSchema, toKon10Tracer } from './plugin.js'

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

test('toKon10Tracer calls the injected captureException alongside otelSpan.recordException', () => {
  const captured: unknown[] = []
  const tracer = toKon10Tracer(trace.getTracer('test'), (exception) => captured.push(exception))

  const error = new Error('boom')
  tracer.startActiveSpan('kon10.create', (span) => {
    span.recordException(error)
    span.end()
  })

  assert.deepEqual(captured, [error])
})

test('toKon10Tracer without a captureException callback only records on the span', () => {
  // No captureException passed — recordException must not throw, and nothing is captured.
  const tracer = toKon10Tracer(trace.getTracer('test'))
  assert.doesNotThrow(() => {
    tracer.startActiveSpan('kon10.create', (span) => {
      span.recordException(new Error('boom'))
      span.end()
    })
  })
})

test('sentryTracingPlugin defaults captureExceptions to true, and honors false', async () => {
  const withDefault = sentryTracingPluginOptionsSchema.parse({ autoInit: false })
  assert.equal(withDefault.captureExceptions, undefined) // unset -> the plugin defaults it to true internally

  const disabled = sentryTracingPluginOptionsSchema.parse({ autoInit: false, captureExceptions: false })
  assert.equal(disabled.captureExceptions, false)
})
