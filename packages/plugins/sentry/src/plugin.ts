/**
 * `sentryTracingPlugin()` — wires Kon10's tracer contract to Sentry via
 * OpenTelemetry.
 *
 * Sentry's Node SDK (v8+) is built on OpenTelemetry: `Sentry.init()`
 * registers Sentry's span processor against the global OTel tracer provider,
 * so a tracer obtained afterwards through `@opentelemetry/api`'s
 * `trace.getTracer()` reports through to Sentry. This plugin does exactly
 * that, then calls `cms.registerTracer()` with the result — Sentry never
 * appears anywhere in `@kon10/core`, `operations.ts`, or the hook engine.
 * Swapping Sentry for another OTel backend later (Honeycomb, Datadog, a
 * plain OTLP collector) means writing a different plugin against the same
 * `Tracer` contract, not touching the kernel.
 *
 * Pass `autoInit: false` to skip `Sentry.init()` and reuse a client the host
 * app already initialized (e.g. it also uses Sentry for error monitoring
 * outside Kon10) — this plugin only wires up the tracer/error reporter in that
 * case.
 *
 * Alongside the tracer, the plugin registers an `ErrorReporter` over
 * `Sentry.captureException()` (`cms.registerErrorReporter()`), so the runner
 * (`@kon10/start`) can report unexpected 500-class failures as Sentry Issues —
 * with the entity/operation as tags — while core stays vendor-neutral. Pass
 * `captureErrors: false` to register the tracer only.
 */

import { trace } from '@opentelemetry/api'
import type { Span as OtelSpan, Tracer as OtelTracer } from '@opentelemetry/api'
import * as Sentry from '@sentry/node'
import { z } from 'zod'
import type { ErrorReporter, Kon10Instance, Plugin, Span, Tracer } from '@kon10/core'

export const sentryTracingPluginOptionsSchema = z.object({
  /** Sentry DSN. Required unless `autoInit: false`. */
  dsn: z.string().optional(),
  environment: z.string().optional(),
  /**
   * Release identifier — should match the browser (`initSentryBrowser`) and the
   * uploaded source maps so server events de-minify. Defaults to
   * `process.env.SENTRY_RELEASE` (set it at deploy time, e.g. to the commit SHA
   * `@kon10/sentry/vite` uploads under).
   */
  release: z.string().optional(),
  /** Fraction of traces sent to Sentry, 0–1. Defaults to 1 (every trace). */
  tracesSampleRate: z.number().min(0).max(1).optional(),
  /** Call `Sentry.init()` with the options above. Defaults to `true`. */
  autoInit: z.boolean().optional(),
  /** Name passed to `trace.getTracer()`. Defaults to `'kon10'`. */
  tracerName: z.string().optional(),
  /**
   * Register an `ErrorReporter` over `Sentry.captureException()` so the runner
   * reports unexpected server errors as Sentry Issues. Defaults to `true`.
   */
  captureErrors: z.boolean().optional(),
})

export type SentryTracingPluginOptions = z.infer<typeof sentryTracingPluginOptionsSchema>

/** Adapt a real `@opentelemetry/api` `Tracer` to Kon10's minimal `Tracer` contract. */
function toKon10Tracer(otelTracer: OtelTracer): Tracer {
  return {
    startActiveSpan<T>(name: string, fn: (span: Span) => T): T {
      return otelTracer.startActiveSpan(name, (otelSpan: OtelSpan) => {
        const span: Span = {
          setAttribute(key, value) {
            otelSpan.setAttribute(key, value)
            return span
          },
          setAttributes(attributes) {
            otelSpan.setAttributes(attributes)
            return span
          },
          recordException(exception) {
            otelSpan.recordException(exception as Error)
          },
          setStatus(status) {
            otelSpan.setStatus(status)
            return span
          },
          end() {
            otelSpan.end()
          },
        }
        return fn(span)
      })
    },
  }
}

/**
 * An `ErrorReporter` over `Sentry.captureException()`. `captureException` must
 * never throw (core's contract), so a failure inside Sentry is swallowed — the
 * original error the caller is reporting must never be shadowed by a reporting
 * failure.
 */
function sentryErrorReporter(): ErrorReporter {
  return {
    captureException(error, context) {
      try {
        Sentry.captureException(error, {
          level: context?.severity ?? 'error',
          tags: context?.tags,
          extra: context?.extra,
        })
      } catch {
        // best-effort — never let reporting break the request path
      }
    },
  }
}

export function sentryTracingPlugin(options: SentryTracingPluginOptions = {}): Plugin {
  const opts = sentryTracingPluginOptionsSchema.parse(options)

  return {
    name: 'sentry',
    onInit(cms: Kon10Instance) {
      if (opts.autoInit !== false) {
        Sentry.init({
          dsn: opts.dsn,
          environment: opts.environment,
          release: opts.release ?? process.env.SENTRY_RELEASE,
          tracesSampleRate: opts.tracesSampleRate ?? 1,
        })
      }
      cms.registerTracer(toKon10Tracer(trace.getTracer(opts.tracerName ?? 'kon10')))
      if (opts.captureErrors !== false) {
        cms.registerErrorReporter(sentryErrorReporter())
      }
      cms.logger.info(
        { plugin: 'sentry', errorTracking: opts.captureErrors !== false },
        'tracing registered (Sentry via OpenTelemetry)',
      )
    },
  }
}
