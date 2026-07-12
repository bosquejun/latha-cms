import assert from 'node:assert/strict'
import { test } from 'node:test'

import { consoleLogger } from '../logger/index.js'
import type { DBAdapter } from '../types/adapter.js'
import { bootstrapKon10, defineConfig } from './index.js'

type Captured = { level: string; obj: Record<string, unknown>; msg: string | undefined }

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

test('boot logs module lifecycle at debug and a summary at info', async () => {
  const lines: Captured[] = []
  const logger = consoleLogger({
    level: 'debug',
    sink: (l, obj, msg) => lines.push({ level: l, obj, msg }),
  })

  const db = nullAdapter()
  const kon10 = await bootstrapKon10(
    defineConfig({ db, logger, modules: [{ name: 'demo', entities: [] }] }),
  )

  // defineConfig wraps the configured logger (redaction), so identity isn't
  // preserved — but everything must still route to the same sink.
  kon10.logger.info('routes to the configured sink')
  assert.ok(lines.some((l) => l.msg === 'routes to the configured sink'))
  // The kernel hands the adapter a `component: 'db'` child logger during boot.
  assert.notEqual(db.logger, undefined)

  const msgs = lines.map((l) => l.msg)
  assert.ok(msgs.includes('module onInit'))
  assert.ok(msgs.includes('migrate start'))
  assert.ok(msgs.includes('module onReady'))

  const booted = lines.find((l) => l.msg === 'kon10 booted')
  assert.ok(booted)
  assert.equal(booted.level, 'info')
  assert.equal(booted.obj['modules'], 1)
  assert.equal(typeof booted.obj['durationMs'], 'number')
})

test('defineConfig wraps a custom logger with redaction by default', () => {
  const captured: Record<string, unknown>[] = []
  const custom = consoleLogger({
    redact: false, // the custom logger itself does nothing — defineConfig must add it
    sink: (_l, obj) => captured.push(obj),
  })

  const resolved = defineConfig({ db: nullAdapter(), logger: custom, modules: [] })
  resolved.logger.info({ passwordHash: 'p', title: 'ok' }, 'x')
  assert.deepEqual(captured[0], { passwordHash: '[REDACTED]', title: 'ok' })
})

test('logRedaction: false leaves a custom logger untouched; an array extends the stems', () => {
  const raw: Record<string, unknown>[] = []
  const rawLogger = consoleLogger({ redact: false, sink: (_l, obj) => raw.push(obj) })
  defineConfig({ db: nullAdapter(), logger: rawLogger, logRedaction: false, modules: [] })
    .logger.info({ password: 'visible' }, 'x')
  assert.deepEqual(raw[0], { password: 'visible' })

  const extended: Record<string, unknown>[] = []
  const extLogger = consoleLogger({ redact: false, sink: (_l, obj) => extended.push(obj) })
  defineConfig({ db: nullAdapter(), logger: extLogger, logRedaction: ['ssn'], modules: [] })
    .logger.info({ ssn: '123', name: 'ok' }, 'x')
  assert.deepEqual(extended[0], { ssn: '[REDACTED]', name: 'ok' })
})

test('an info-level logger suppresses the lifecycle debug lines', async () => {
  const lines: Captured[] = []
  const logger = consoleLogger({
    level: 'info',
    sink: (l, obj, msg) => lines.push({ level: l, obj, msg }),
  })

  await bootstrapKon10(
    defineConfig({ db: nullAdapter(), logger, modules: [{ name: 'demo', entities: [] }] }),
  )

  assert.deepEqual(
    lines.map((l) => l.msg),
    ['kon10 booted'],
  )
})
