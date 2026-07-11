import assert from 'node:assert/strict'
import { test } from 'node:test'

import { consoleLogger, silentLogger, type LogLevel } from './index.js'

type Captured = { level: string; obj: Record<string, unknown>; msg: string | undefined }

function capture(level?: LogLevel) {
  const lines: Captured[] = []
  const logger = consoleLogger({
    level,
    sink: (l, obj, msg) => lines.push({ level: l, obj, msg }),
  })
  return { logger, lines }
}

test('emits at or above the threshold, filters below', () => {
  const { logger, lines } = capture('warn')
  logger.debug('d')
  logger.info('i')
  logger.warn('w')
  logger.error('e')
  assert.deepEqual(
    lines.map((l) => l.level),
    ['warn', 'error'],
  )
})

test('default level is info', () => {
  const { logger, lines } = capture()
  logger.debug('d')
  logger.info('i')
  assert.deepEqual(
    lines.map((l) => l.level),
    ['info'],
  )
})

test('silent level emits nothing', () => {
  const { logger, lines } = capture('silent')
  logger.error('e')
  assert.equal(lines.length, 0)
})

test('supports (msg) and (obj, msg) overloads', () => {
  const { logger, lines } = capture('debug')
  logger.info('just a message')
  logger.info({ a: 1 }, 'with fields')
  logger.info({ b: 2 })
  assert.deepEqual(lines[0], { level: 'info', obj: {}, msg: 'just a message' })
  assert.deepEqual(lines[1], { level: 'info', obj: { a: 1 }, msg: 'with fields' })
  assert.deepEqual(lines[2], { level: 'info', obj: { b: 2 }, msg: undefined })
})

test('child merges bindings, child wins on conflict, level and sink inherited', () => {
  const lines: Captured[] = []
  const root = consoleLogger({
    level: 'warn',
    bindings: { component: 'root', keep: true },
    sink: (l, obj, msg) => lines.push({ level: l, obj, msg }),
  })
  const child = root.child({ component: 'child', requestId: 'r1' })
  child.info('filtered')
  child.warn({ extra: 1 }, 'kept')
  assert.equal(lines.length, 1)
  assert.deepEqual(lines[0]!.obj, {
    component: 'child',
    keep: true,
    requestId: 'r1',
    extra: 1,
  })
})

test('call-site obj wins over bindings', () => {
  const lines: Captured[] = []
  const logger = consoleLogger({
    bindings: { requestId: 'bound' },
    sink: (l, obj, msg) => lines.push({ level: l, obj, msg }),
  })
  logger.info({ requestId: 'call' }, 'x')
  assert.equal(lines[0]!.obj['requestId'], 'call')
})

test('KON10_LOG_LEVEL is respected and invalid values fall back to info', () => {
  const prev = process.env['KON10_LOG_LEVEL']
  try {
    process.env['KON10_LOG_LEVEL'] = 'debug'
    const a = capture()
    a.logger.debug('d')
    assert.equal(a.lines.length, 1)

    process.env['KON10_LOG_LEVEL'] = 'not-a-level'
    const b = capture()
    b.logger.debug('d')
    b.logger.info('i')
    assert.deepEqual(
      b.lines.map((l) => l.level),
      ['info'],
    )

    // Explicit option beats the env var.
    process.env['KON10_LOG_LEVEL'] = 'error'
    const c = capture('debug')
    c.logger.debug('d')
    assert.equal(c.lines.length, 1)
  } finally {
    if (prev === undefined) delete process.env['KON10_LOG_LEVEL']
    else process.env['KON10_LOG_LEVEL'] = prev
  }
})

test('silentLogger no-ops and child() returns itself', () => {
  assert.equal(silentLogger.child({ a: 1 }), silentLogger)
  silentLogger.error({ boom: true }, 'nothing happens')
})
