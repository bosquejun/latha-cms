/**
 * Delivery-API error-reporting coverage: a genuine 500 is reported to the
 * registered `ErrorReporter` (the seam `@kon10/sentry` fills) with entity tags,
 * while expected control flow — a 403 access denial, a 404 — is never reported.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defineConfig,
  silentLogger,
  stampFields,
  text,
  type DBAdapter,
  type Entity,
  type ErrorReportContext,
  type Plugin,
} from '@kon10/core'
import { AuthModule } from '@kon10/auth'
import { handleDeliveryRequest } from './api.js'

/** In-memory adapter whose reads throw for one slug only (the 500 path). */
function explodingAdapter(explodeSlug: string): DBAdapter {
  const tables = new Map<string, Map<string, Record<string, unknown> & { id: string }>>()
  let seq = 0
  const table = (slug: string) => {
    let t = tables.get(slug)
    if (!t) tables.set(slug, (t = new Map()))
    return t
  }
  const check = (slug: string) => {
    if (slug === explodeSlug) throw new Error('db exploded')
  }
  return {
    async find(slug) {
      check(slug)
      return [...table(slug).values()]
    },
    async findOne(slug, id) {
      check(slug)
      return table(slug).get(id) ?? null
    },
    async count(slug) {
      check(slug)
      return table(slug).size
    },
    async create(slug, data) {
      const doc = { id: `r${++seq}`, ...data }
      table(slug).set(doc.id, doc)
      return doc
    },
    async update(slug, id, data) {
      const doc = { ...table(slug).get(id)!, ...data, id }
      table(slug).set(id, doc)
      return doc
    },
    async delete(slug, id) {
      table(slug).delete(id)
    },
    async migrate() {},
  }
}

const gadget: Entity = {
  cardinality: 'many',
  slug: 'gadget',
  actions: ['read'],
  access: { read: () => true },
  fields: stampFields({ name: text({ required: true }) }),
}

// A second entity whose reads are always denied — the 403 path.
const secret: Entity = {
  cardinality: 'many',
  slug: 'secret',
  actions: ['read'],
  access: { read: () => false },
  fields: stampFields({ name: text({ required: true }) }),
}

const captured: Array<{ error: unknown; context?: ErrorReportContext }> = []

/** A plugin that wires a capturing ErrorReporter — stands in for `@kon10/sentry`. */
const capturingReporterPlugin: Plugin = {
  name: 'test-error-reporter',
  onInit(cms) {
    cms.registerErrorReporter({
      captureException(error, context) {
        captured.push({ error, context })
      },
    })
  },
}

const config = defineConfig({
  db: explodingAdapter('gadget'),
  logger: silentLogger,
  plugins: [capturingReporterPlugin],
  modules: [
    AuthModule({ secret: 'test-secret' }),
    { name: 'gadgets', entities: [gadget] },
    { name: 'secrets', entities: [secret] },
  ],
})

test('a genuine 500 is reported with entity/surface tags', async () => {
  captured.length = 0
  const res = await handleDeliveryRequest(config, new Request('http://cms.test/api/v1/gadgets'))
  assert.equal(res.status, 500)

  assert.equal(captured.length, 1)
  const report = captured[0]!
  assert.ok(report.error instanceof Error)
  assert.equal((report.error as Error).message, 'db exploded')
  assert.equal(report.context?.tags?.['surface'], 'api')
  assert.equal(report.context?.tags?.['slug'], 'gadget')
  assert.equal(typeof report.context?.extra?.['requestId'], 'string')
})

test('an access-denied 403 is NOT reported (expected control flow)', async () => {
  captured.length = 0
  const res = await handleDeliveryRequest(config, new Request('http://cms.test/api/v1/secrets'))
  assert.equal(res.status, 403)
  assert.equal(captured.length, 0)
})

test('a 404 is NOT reported', async () => {
  captured.length = 0
  const res = await handleDeliveryRequest(config, new Request('http://cms.test/api/v1/nope'))
  assert.equal(res.status, 404)
  assert.equal(captured.length, 0)
})
