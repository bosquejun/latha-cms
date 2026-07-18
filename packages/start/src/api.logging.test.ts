/**
 * Delivery-API logging + traceability coverage: every request emits exactly
 * one structured log line, failures carry a `requestId` correlation id in the
 * envelope (always on 500s), and the widened `apiErrorSchema` stays backward
 * compatible with clients validating against the old `{code, message}` shape.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  consoleLogger,
  defineConfig,
  stampFields,
  text,
  z,
  type DBAdapter,
  type Entity,
  type LogLevel,
} from '@kon10/core'
import { AuthModule } from '@kon10/auth'
import { handleDeliveryRequest } from './api.js'
import { apiResponseSchema, type ApiResponse } from './envelope.js'

type Captured = { level: string; obj: Record<string, unknown>; msg: string | undefined }

function captureLogger(level: LogLevel = 'debug') {
  const lines: Captured[] = []
  const logger = consoleLogger({
    level,
    sink: (l, obj, msg) => lines.push({ level: l, obj, msg }),
  })
  return { logger, lines }
}

/**
 * A working in-memory adapter whose reads blow up for one slug only — the
 * INTERNAL_ERROR path. Other slugs behave, so AuthModule can boot normally.
 */
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

const gadgetsEntity: Entity = {
  cardinality: 'many',
  slug: 'gadget',
  actions: ['read'],
  access: { read: () => true },
  fields: stampFields({ name: text({ required: true }) }),
}

const { logger, lines } = captureLogger()

const config = defineConfig({
  db: explodingAdapter('gadget'),
  logger,
  modules: [
    AuthModule({ secret: 'test-secret' }),
    { name: 'gadgets', entities: [gadgetsEntity] },
  ],
})

/** Log lines from this package's request surfaces (skip core boot lines). */
const requestLines = () => lines.filter((l) => l.obj['surface'] === 'api')

test('a 500 logs one error line and returns a matching requestId in the envelope', async () => {
  lines.length = 0
  const res = await handleDeliveryRequest(config, new Request('http://cms.test/api/v1/gadgets'))
  assert.equal(res.status, 500)

  const body = (await res.json()) as ApiResponse<unknown>
  assert.equal(body.data, null)
  assert.equal(body.error?.code, 'INTERNAL_ERROR')
  assert.equal(typeof body.error?.requestId, 'string')

  const logged = requestLines()
  assert.equal(logged.length, 1)
  const line = logged[0]!
  assert.equal(line.level, 'error')
  assert.equal(line.obj['requestId'], body.error?.requestId)
  assert.equal(line.obj['status'], 500)
  assert.equal(line.obj['method'], 'GET')
  assert.equal(line.obj['err'], 'db exploded')
  assert.equal(typeof line.obj['durationMs'], 'number')
})

test('a 404 logs exactly one info line with request metadata', async () => {
  lines.length = 0
  const res = await handleDeliveryRequest(config, new Request('http://cms.test/api/v1/nope'))
  assert.equal(res.status, 404)

  const logged = requestLines()
  assert.equal(logged.length, 1)
  assert.equal(logged[0]!.level, 'info')
  assert.equal(logged[0]!.obj['status'], 404)
  assert.equal(typeof logged[0]!.obj['requestId'], 'string')
})

test('the widened error envelope still parses against the old client schema shape', async () => {
  const res = await handleDeliveryRequest(config, new Request('http://cms.test/api/v1/gadgets'))
  const body: unknown = await res.json()

  // Today's schema accepts it…
  assert.equal(apiResponseSchema(z.array(z.unknown())).safeParse(body).success, true)

  // …and so does the pre-`requestId` schema an older client may have baked in.
  const legacySchema = z.union([
    z.object({ data: z.array(z.unknown()), error: z.null() }),
    z.object({ data: z.null(), error: z.object({ code: z.string(), message: z.string() }) }),
  ])
  assert.equal(legacySchema.safeParse(body).success, true)
})
