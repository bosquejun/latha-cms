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

export interface ConsoleLoggerOptions {
  /** Minimum level to emit. Beats `KON10_LOG_LEVEL`; default `'info'`. */
  level?: LogLevel
  /** Bindings stamped onto every line (merged into each call's `obj`). */
  bindings?: Record<string, unknown>
  /**
   * Where lines go. Defaults to the matching `console` method. Injectable so
   * tests can capture output without monkey-patching `console`.
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

const defaultSink: NonNullable<ConsoleLoggerOptions['sink']> = (level, obj, msg) => {
  const line = `[kon10] ${level}${msg ? ` ${msg}` : ''}`

  console[level](Object.keys(obj).length > 0 ? `${line} ${JSON.stringify(obj)}` : line)
}

/** The default `Logger`: console-backed, level-thresholded, zero dependencies. */
export function consoleLogger(options: ConsoleLoggerOptions = {}): Logger {
  const level = options.level ?? envLevel() ?? 'info'
  const bindings = options.bindings ?? {}
  const sink = options.sink ?? defaultSink
  const threshold = LEVEL_RANK[level]

  const logAt =
    (at: EmitLevel): LogFn =>
    (objOrMsg: Record<string, unknown> | string, msg?: string) => {
      if (LEVEL_RANK[at] < threshold) return
      if (typeof objOrMsg === 'string') sink(at, bindings, objOrMsg)
      else sink(at, { ...bindings, ...objOrMsg }, msg)
    }

  return {
    debug: logAt('debug'),
    info: logAt('info'),
    warn: logAt('warn'),
    error: logAt('error'),
    child: (childBindings) =>
      consoleLogger({ level, sink, bindings: { ...bindings, ...childBindings } }),
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
