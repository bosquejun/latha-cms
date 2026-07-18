import assert from 'node:assert/strict'
import test from 'node:test'
import type { ErrorReportContext } from '../errors/index.js'
import type { DBAdapter } from '../types/adapter.js'
import { bootstrapKon10, defineConfig } from './index.js'

test('bootstrap reports DB connection failures after monitoring initializes', async () => {
  const failure = new Error('database unavailable')
  const reports: Array<{ error: unknown; context?: ErrorReportContext }> = []
  const db = {
    async connect() {
      throw failure
    },
    async find() { return [] },
    async findOne() { return null },
    async count() { return 0 },
    async create(_slug, data) { return { id: '1', ...data } },
    async update(_slug, id, data) { return { id, ...data } },
    async delete() {},
    async migrate() {},
  } satisfies DBAdapter

  await assert.rejects(
    bootstrapKon10(defineConfig({
      db,
      modules: [],
      plugins: [{
        name: 'monitoring',
        onInit(cms) {
          cms.registerErrorReporter({
            captureException(error, context) {
              reports.push({ error, context })
            },
          })
        },
      }],
    })),
    failure,
  )

  assert.equal(reports.length, 1)
  assert.equal(reports[0]?.error, failure)
  assert.deepEqual(reports[0]?.context?.tags, {
    surface: 'bootstrap',
    stage: 'db-connect',
  })
  assert.equal(reports[0]?.context?.severity, 'fatal')
})
