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

  assert.equal(kon10.logger, logger)
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
