/**
 * Minimal structured logger contract + console-backed default.
 *
 * The `Logger` interface is a plain TS interface, not a Zod schema: Zod-first
 * applies to validatable data shapes, and a logger is behavior. The one piece
 * of data here — the level — IS Zod-validated (`logLevelSchema`). The method
 * shape is pino-compatible (`debug/info/warn/error` taking `(obj, msg?)` or
 * `(msg)`, plus `child(bindings)`), so `logger: pino()` satisfies it directly.
 *
 * Core stays dependency-free: the default is `consoleLogger()`, one line per
 * call via the matching `console` method. Level comes from the option or the
 * `KON10_LOG_LEVEL` env var (default `'info'`); `silentLogger` is for tests.
 */

import { z } from 'zod'

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'silent'])
export type LogLevel = z.infer<typeof logLevelSchema>

/** Pino-compatible log method: `(obj, msg?)` or `(msg)`. */
export interface LogFn {
  (obj: Record<string, unknown>, msg?: string): void
  (msg: string): void
}

export interface Logger {
  debug: LogFn
  info: LogFn
  warn: LogFn
  error: LogFn
  /** A logger that stamps `bindings` onto every line (e.g. a per-request id). */
  child(bindings: Record<string, unknown>): Logger
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
}

type EmitLevel = Exclude<LogLevel, 'silent'>

/**
 * Key stems redacted from logged objects by default. Matching is
 * case-insensitive and substring-based (`passwordHash`, `Authorization`,
 * `dbToken` all match), which errs toward over-redaction — the right default
 * for a CMS where hooks and modules may log whole documents. Extend via
 * `KON10_LOG_REDACT` (comma-separated stems) or `ConsoleLoggerOptions.redact`.
 */
export const DEFAULT_REDACT_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'credential',
  'keyhash',
  'privatekey',
  'private_key',
] as const

export const redactKeysSchema = z.array(z.string().min(1))

const REDACTED = '[REDACTED]'
const MAX_REDACT_DEPTH = 6

export interface ConsoleLoggerOptions {
  /** Minimum level to emit. Beats `KON10_LOG_LEVEL`; default `'info'`. */
  level?: LogLevel
  /** Bindings stamped onto every line (merged into each call's `obj`). */
  bindings?: Record<string, unknown>
  /**
   * Extra key stems to redact on top of `DEFAULT_REDACT_KEYS` and
   * `KON10_LOG_REDACT`, or `false` to disable redaction entirely.
   */
  redact?: string[] | false
  /**
   * Where lines go. Defaults to the matching `console` method. Injectable so
   * tests can capture output without monkey-patching `console`. Receives the
   * already-redacted object.
   */
  sink?: (level: EmitLevel, obj: Record<string, unknown>, msg: string | undefined) => void
}

// Avoid a hard @types/node dependency; guarded for non-Node runtimes.
declare const process: { env?: Record<string, string | undefined> } | undefined

function envLevel(): LogLevel | undefined {
  const raw =
    typeof process !== 'undefined' ? process?.env?.['KON10_LOG_LEVEL'] : undefined
  const parsed = logLevelSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

/** Extra redact stems from `KON10_LOG_REDACT` (comma-separated). */
function envRedactKeys(): string[] {
  const raw =
    typeof process !== 'undefined' ? process?.env?.['KON10_LOG_REDACT'] : undefined
  if (!raw) return []
  const parsed = redactKeysSchema.safeParse(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  return parsed.success ? parsed.data : []
}

/**
 * Build a redactor for the given key stems: any property whose name contains
 * one of the stems (case-insensitive) has its entire value replaced with
 * `[REDACTED]`, recursively through nested objects and arrays. Returns a new
 * object — the caller's input is never mutated. Depth-capped so a cyclic or
 * pathological value can't recurse forever.
 */
function buildRedactor(
  stems: string[],
): (obj: Record<string, unknown>) => Record<string, unknown> {
  const lowered = stems.map((s) => s.toLowerCase())
  const sensitive = (key: string) => {
    const k = key.toLowerCase()
    return lowered.some((stem) => k.includes(stem))
  }
  const walk = (value: unknown, depth: number): unknown => {
    if (value === null || typeof value !== 'object' || depth > MAX_REDACT_DEPTH) return value
    if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1))
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = sensitive(k) ? REDACTED : walk(v, depth + 1)
    }
    return out
  }
  return (obj) => walk(obj, 0) as Record<string, unknown>
}

const defaultSink: NonNullable<ConsoleLoggerOptions['sink']> = (level, obj, msg) => {
  const line = `[kon10] ${level}${msg ? ` ${msg}` : ''}`

  console[level](Object.keys(obj).length > 0 ? `${line} ${JSON.stringify(obj)}` : line)
}

/**
 * The default `Logger`: console-backed, level-thresholded, zero dependencies.
 * Logged objects are redacted before they reach the sink (see
 * `DEFAULT_REDACT_KEYS`); a custom `logger` (e.g. pino) is responsible for
 * its own redaction.
 */
export function consoleLogger(options: ConsoleLoggerOptions = {}): Logger {
  const level = options.level ?? envLevel() ?? 'info'
  const bindings = options.bindings ?? {}
  const sink = options.sink ?? defaultSink
  const threshold = LEVEL_RANK[level]
  const redact =
    options.redact === false
      ? (obj: Record<string, unknown>) => obj
      : buildRedactor([...DEFAULT_REDACT_KEYS, ...envRedactKeys(), ...(options.redact ?? [])])

  const logAt =
    (at: EmitLevel): LogFn =>
    (objOrMsg: Record<string, unknown> | string, msg?: string) => {
      if (LEVEL_RANK[at] < threshold) return
      if (typeof objOrMsg === 'string') sink(at, redact(bindings), objOrMsg)
      else sink(at, redact({ ...bindings, ...objOrMsg }), msg)
    }

  return {
    debug: logAt('debug'),
    info: logAt('info'),
    warn: logAt('warn'),
    error: logAt('error'),
    child: (childBindings) =>
      consoleLogger({
        level,
        sink,
        redact: options.redact,
        bindings: { ...bindings, ...childBindings },
      }),
  }
}

/**
 * Wrap ANY `Logger` (e.g. a pino instance) so logged objects — and bindings
 * passed to `child()` through the wrapper — are redacted before delegation.
 * Stems are `DEFAULT_REDACT_KEYS` + `KON10_LOG_REDACT` + `extra`. This is how
 * `defineConfig` makes redaction hold for custom loggers, not just the
 * built-in one. (Bindings baked into the logger *before* wrapping can't be
 * intercepted — keep secrets out of pre-existing bindings.)
 */
export function redactLogger(logger: Logger, extra: string[] = []): Logger {
  const redact = buildRedactor([...DEFAULT_REDACT_KEYS, ...envRedactKeys(), ...extra])
  const wrap = (fn: LogFn): LogFn =>
    ((objOrMsg: Record<string, unknown> | string, msg?: string) => {
      if (typeof objOrMsg === 'string') fn(objOrMsg)
      else fn(redact(objOrMsg), msg)
    }) as LogFn
  return {
    debug: wrap(logger.debug.bind(logger)),
    info: wrap(logger.info.bind(logger)),
    warn: wrap(logger.warn.bind(logger)),
    error: wrap(logger.error.bind(logger)),
    child: (bindings) => redactLogger(logger.child(redact(bindings)), extra),
  }
}

const noop: LogFn = () => {}

/** Every method no-ops; `child()` returns itself. For tests. */
export const silentLogger: Logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  child: () => silentLogger,
}
