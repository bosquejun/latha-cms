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
 * outside Kon10) — this plugin only wires up the tracer in that case.
 */

import { trace } from '@opentelemetry/api'
import type { Span as OtelSpan, Tracer as OtelTracer } from '@opentelemetry/api'
import * as Sentry from '@sentry/node'
import { z } from 'zod'
import type { Kon10Instance, Plugin, Span, Tracer } from '@kon10/core'

export const sentryTracingPluginOptionsSchema = z.object({
  /** Sentry DSN. Required unless `autoInit: false`. */
  dsn: z.string().optional(),
  environment: z.string().optional(),
  /** Fraction of traces sent to Sentry, 0–1. Defaults to 1 (every trace). */
  tracesSampleRate: z.number().min(0).max(1).optional(),
  /** Call `Sentry.init()` with the options above. Defaults to `true`. */
  autoInit: z.boolean().optional(),
  /** Name passed to `trace.getTracer()`. Defaults to `'kon10'`. */
  tracerName: z.string().optional(),
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

export function sentryTracingPlugin(options: SentryTracingPluginOptions = {}): Plugin {
  const opts = sentryTracingPluginOptionsSchema.parse(options)

  return {
    name: 'sentry',
    onInit(cms: Kon10Instance) {
      if (opts.autoInit !== false) {
        Sentry.init({
          dsn: opts.dsn,
          environment: opts.environment,
          tracesSampleRate: opts.tracesSampleRate ?? 1,
        })
      }
      cms.registerTracer(toKon10Tracer(trace.getTracer(opts.tracerName ?? 'kon10')))
      cms.logger.info({ plugin: 'sentry' }, 'tracing registered (Sentry via OpenTelemetry)')
    },
  }
}
