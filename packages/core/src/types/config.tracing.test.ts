import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapKon10, defineConfig } from '../bootstrap/index.js'
import { noopTracer } from '../tracing/index.js'
import type { Tracer } from '../tracing/index.js'
import type { DBAdapter } from './adapter.js'

function fakeDb(): DBAdapter {
  return {
    async find() { return [] },
    async findOne() { return null },
    async count() { return 0 },
    async create(_c, data) { return { id: '1', ...data } },
    async update(_c, id, data) { return { id, ...data } },
    async delete() {},
    async migrate() {},
  }
}

test('tracer defaults to noopTracer when no module/plugin registers one', async () => {
  const kon10 = await bootstrapKon10(defineConfig({ db: fakeDb(), modules: [] }))
  assert.equal(kon10.tracer, noopTracer)
})

test('a plugin can register a tracer via registerTracer', async () => {
  const tracer: Tracer = {
    startActiveSpan: (_name, fn) => fn({
      setAttribute() { return this as never },
      setAttributes() { return this as never },
      recordException() {},
      setStatus() { return this as never },
      end() {},
    }),
  }
  const kon10 = await bootstrapKon10(
    defineConfig({
      db: fakeDb(),
      modules: [],
      plugins: [{ name: 'tracing', onInit: (cms) => cms.registerTracer(tracer) }],
    }),
  )
  assert.equal(kon10.tracer, tracer)
})
