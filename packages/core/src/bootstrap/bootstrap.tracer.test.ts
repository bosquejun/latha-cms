import assert from 'node:assert/strict'
import { test } from 'node:test'

import { noopTracer, type Span, type Tracer } from '../tracing/index.js'
import type { DBAdapter } from '../types/adapter.js'
import { bootstrapKon10, defineConfig } from './index.js'

function nullAdapter(): DBAdapter {
  return {
    find: async () => [],
    findOne: async () => null,
    count: async () => 0,
    create: async (_slug, data) => ({ id: '1', ...data }),
    update: async (_slug, id, data) => ({ id, ...data }),
    delete: async () => {},
    migrate: async () => {},
  }
}

/** A distinguishable tracer so we can assert identity, not just presence. */
function markerTracer(): Tracer {
  return {
    startActiveSpan<T>(_name: string, fn: (span: Span) => T): T {
      return fn(noopTracer.startActiveSpan('', (s) => s) as unknown as Span)
    },
  }
}

test('boot hands the adapter the tracer a plugin registered in onInit', async () => {
  const custom = markerTracer()
  const db = nullAdapter()

  await bootstrapKon10(
    defineConfig({
      db,
      modules: [],
      plugins: [{ name: 'tracing', onInit: (cms) => cms.registerTracer(custom) }],
    }),
  )

  // The plugin's tracer is registered during onInit, which runs before the
  // kernel assigns `db.tracer` — so the adapter sees the real one, not the noop.
  assert.equal(db.tracer, custom)
})

test('boot defaults the adapter tracer to the noop when no one registers one', async () => {
  const db = nullAdapter()
  await bootstrapKon10(defineConfig({ db, modules: [] }))
  assert.equal(db.tracer, noopTracer)
})

test('boot respects a tracer the adapter already wired itself', async () => {
  const own = markerTracer()
  const db = nullAdapter()
  db.tracer = own

  await bootstrapKon10(
    defineConfig({
      db,
      modules: [],
      plugins: [{ name: 'tracing', onInit: (cms) => cms.registerTracer(markerTracer()) }],
    }),
  )

  // `??=` must not clobber an adapter that brought its own tracer.
  assert.equal(db.tracer, own)
})
