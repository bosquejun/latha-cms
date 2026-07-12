import assert from 'node:assert/strict'
import { test } from 'node:test'

import { consoleLogger, redactLogger, silentLogger, type Logger, type LogLevel } from './index.js'

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

test('default redaction masks sensitive keys, case-insensitively and by substring', () => {
  const { logger, lines } = capture()
  logger.info(
    {
      email: 'a@b.c',
      passwordHash: 'pbkdf2$abc',
      Authorization: 'Bearer kon10_xyz',
      dbToken: 'tok',
      api_key: 'k',
      safeCount: 3,
    },
    'x',
  )
  assert.deepEqual(lines[0]!.obj, {
    email: 'a@b.c',
    passwordHash: '[REDACTED]',
    Authorization: '[REDACTED]',
    dbToken: '[REDACTED]',
    api_key: '[REDACTED]',
    safeCount: 3,
  })
})

test('redaction recurses into nested objects and arrays, and redacts whole object values', () => {
  const { logger, lines } = capture()
  const input = {
    doc: { title: 'hi', credentials: { user: 'u', pass: 'p' } },
    users: [{ name: 'a', password: 'p1' }, { name: 'b' }],
  }
  logger.info(input, 'x')
  assert.deepEqual(lines[0]!.obj, {
    doc: { title: 'hi', credentials: '[REDACTED]' },
    users: [{ name: 'a', password: '[REDACTED]' }, { name: 'b' }],
  })
  // The caller's object is never mutated.
  assert.equal(input.users[0]!.password, 'p1')
})

test('redaction covers bindings, including on string-only calls', () => {
  const lines: Captured[] = []
  const logger = consoleLogger({
    bindings: { component: 'db', authToken: 'shhh' },
    sink: (l, obj, msg) => lines.push({ level: l, obj, msg }),
  })
  logger.info('just a message')
  assert.deepEqual(lines[0]!.obj, { component: 'db', authToken: '[REDACTED]' })
})

test('KON10_LOG_REDACT extends the default stems', () => {
  const prev = process.env['KON10_LOG_REDACT']
  try {
    process.env['KON10_LOG_REDACT'] = 'ssn, internalNote'
    const { logger, lines } = capture()
    logger.info({ ssn: '123', internalnote: 'x', title: 'ok', password: 'p' }, 'x')
    assert.deepEqual(lines[0]!.obj, {
      ssn: '[REDACTED]',
      internalnote: '[REDACTED]',
      title: 'ok',
      password: '[REDACTED]',
    })
  } finally {
    if (prev === undefined) delete process.env['KON10_LOG_REDACT']
    else process.env['KON10_LOG_REDACT'] = prev
  }
})

test('the redact option extends defaults; children inherit it', () => {
  const lines: Captured[] = []
  const logger = consoleLogger({
    redact: ['customerId'],
    sink: (l, obj, msg) => lines.push({ level: l, obj, msg }),
  })
  logger.child({ requestId: 'r1' }).info({ customerId: 'c1', secretKey: 's', ok: 1 }, 'x')
  assert.deepEqual(lines[0]!.obj, {
    requestId: 'r1',
    customerId: '[REDACTED]',
    secretKey: '[REDACTED]',
    ok: 1,
  })
})

/** A pino-shaped stand-in that records everything it's handed, raw. */
function fakeExternalLogger() {
  const calls: { obj?: Record<string, unknown>; msg?: string }[] = []
  const record: Logger['info'] = ((objOrMsg: Record<string, unknown> | string, msg?: string) => {
    if (typeof objOrMsg === 'string') calls.push({ msg: objOrMsg })
    else calls.push({ obj: objOrMsg, msg })
  }) as Logger['info']
  const logger: Logger = {
    debug: record,
    info: record,
    warn: record,
    error: record,
    child: () => logger,
  }
  return { logger, calls }
}

test('redactLogger wraps a custom logger so KON10_LOG_REDACT + defaults apply to it', () => {
  const prev = process.env['KON10_LOG_REDACT']
  try {
    process.env['KON10_LOG_REDACT'] = 'ssn'
    const { logger: external, calls } = fakeExternalLogger()
    const wrapped = redactLogger(external, ['customerId'])
    wrapped.info({ password: 'p', ssn: '123', customerId: 'c1', ok: true }, 'x')
    wrapped.warn('plain message untouched')
    assert.deepEqual(calls[0], {
      obj: { password: '[REDACTED]', ssn: '[REDACTED]', customerId: '[REDACTED]', ok: true },
      msg: 'x',
    })
    assert.deepEqual(calls[1], { msg: 'plain message untouched' })
  } finally {
    if (prev === undefined) delete process.env['KON10_LOG_REDACT']
    else process.env['KON10_LOG_REDACT'] = prev
  }
})

test('redactLogger redacts child() bindings before they reach the wrapped logger', () => {
  let seenBindings: Record<string, unknown> | undefined
  const { logger: base } = fakeExternalLogger()
  const external: Logger = {
    ...base,
    child: (bindings) => {
      seenBindings = bindings
      return external
    },
  }
  redactLogger(external).child({ requestId: 'r1', sessionToken: 'shhh' })
  assert.deepEqual(seenBindings, { requestId: 'r1', sessionToken: '[REDACTED]' })
})

test('redact: false disables redaction entirely', () => {
  const lines: Captured[] = []
  const logger = consoleLogger({
    redact: false,
    sink: (l, obj, msg) => lines.push({ level: l, obj, msg }),
  })
  logger.info({ password: 'visible' }, 'x')
  assert.deepEqual(lines[0]!.obj, { password: 'visible' })
})
