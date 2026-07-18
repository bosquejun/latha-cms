/**
 * PostHog sink — a `Telemetry` that batches events and POSTs them to PostHog's
 * `/batch/` capture API with `fetch`. No SDK dependency. Every network call is
 * best-effort and swallowed: telemetry must never break or slow the app, so
 * failures drop the batch silently.
 */

import type { Telemetry, TelemetryEvent, TelemetryPropertyValue } from '@kon10/core'

export interface PosthogTelemetryOptions {
  /** PostHog project API key (`phc_...`). */
  apiKey: string
  /** PostHog host, e.g. `https://us.i.posthog.com`. */
  host: string
  /** Anonymous `distinct_id` for every event. */
  distinctId: string
  /** Properties merged into every event (e.g. app name). */
  commonProperties?: Record<string, TelemetryPropertyValue>
  /** Auto-flush interval. Default 15s. */
  flushIntervalMs?: number
  /** Flush once the queue reaches this size. Default 20. */
  batchSize?: number
  /** Optional debug logger. */
  debug?: (message: string, error?: unknown) => void
}

interface PosthogEvent {
  event: string
  distinct_id: string
  properties: Record<string, TelemetryPropertyValue>
  timestamp: string
}

/** Drop `undefined` properties so the payload stays clean. */
function clean(
  props: Record<string, TelemetryPropertyValue | undefined>,
): Record<string, TelemetryPropertyValue> {
  const out: Record<string, TelemetryPropertyValue> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

export function createPosthogTelemetry(opts: PosthogTelemetryOptions): Telemetry {
  const flushIntervalMs = opts.flushIntervalMs ?? 15_000
  const batchSize = opts.batchSize ?? 20
  const endpoint = `${opts.host.replace(/\/+$/, '')}/batch/`
  const queue: PosthogEvent[] = []

  async function flush(): Promise<void> {
    if (queue.length === 0) return
    const batch = queue.splice(0, queue.length)
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: opts.apiKey, batch }),
      })
    } catch (error) {
      // Best-effort — drop the batch; never surface telemetry failures.
      opts.debug?.('telemetry flush failed', error)
    }
  }

  // A background flush timer that never keeps the process alive on its own.
  const timer = setInterval(() => void flush(), flushIntervalMs)
  timer.unref?.()
  // Best-effort flush on graceful exit.
  process.once('beforeExit', () => void flush())

  return {
    capture(event: TelemetryEvent) {
      queue.push({
        event: event.name,
        distinct_id: opts.distinctId,
        properties: clean({ ...opts.commonProperties, ...event.properties }),
        timestamp: new Date().toISOString(),
      })
      if (queue.length >= batchSize) void flush()
    },
    flush,
  }
}
