import assert from 'node:assert/strict'
import { test } from 'node:test'

import { noopTracer, SpanStatusCode, withSpan } from './index.js'
import type { Span, Tracer } from './index.js'

interface SpanRecord {
  name: string
  attrs: Record<string, unknown>
  status?: { code: number; message?: string }
  ended: boolean
}

function recordingTracer() {
  const spans: SpanRecord[] = []
  const tracer: Tracer = {
    startActiveSpan(name, fn) {
      const record: SpanRecord = { name, attrs: {}, ended: false }
      spans.push(record)
      const span: Span = {
        setAttribute(key, value) {
          record.attrs[key] = value
          return span
        },
        setAttributes(attrs) {
          Object.assign(record.attrs, attrs)
          return span
        },
        recordException: () => {},
        setStatus(status) {
          record.status = status
          return span
        },
        end() {
          record.ended = true
        },
      }
      return fn(span)
    },
  }
  return { tracer, spans }
}

test('noopTracer runs fn against a span that does nothing', () => {
  const result = noopTracer.startActiveSpan('x', (span) => {
    span.setAttribute('a', 1).setAttributes({ b: 'x' }).setStatus({ code: SpanStatusCode.OK })
    span.recordException(new Error('ignored'))
    span.end()
    return 42
  })
  assert.equal(result, 42)
})

test('withSpan returns the result and always ends the span', async () => {
  const { tracer, spans } = recordingTracer()
  const result = await withSpan(tracer, 'kon10.find', async (span) => {
    span.setAttribute('kon10.entity', 'posts')
    return 'ok'
  })
  assert.equal(result, 'ok')
  assert.equal(spans.length, 1)
  const span = spans[0]!
  assert.equal(span.name, 'kon10.find')
  assert.deepEqual(span.attrs, { 'kon10.entity': 'posts' })
  assert.equal(span.ended, true)
})

test('withSpan records the exception, sets ERROR status, ends the span, and rethrows', async () => {
  const { tracer, spans } = recordingTracer()
  await assert.rejects(
    withSpan(tracer, 'kon10.create', async () => {
      throw new Error('boom')
    }),
    /boom/,
  )
  const span = spans[0]!
  assert.equal(span.ended, true)
  assert.deepEqual(span.status, { code: SpanStatusCode.ERROR, message: 'boom' })
})
