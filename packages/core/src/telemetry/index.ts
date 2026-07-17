/**
 * Telemetry contract + no-op default.
 *
 * A minimal, vendor-neutral event sink — the same shape of seam as the tracer:
 * core defines the contract and ships a no-op, and a plugin (`@kon10/telemetry`)
 * registers a real sink (PostHog). The kernel and runners emit events through
 * `cms.telemetry` unconditionally; a no-op costs nothing.
 *
 * Events must carry only allow-listed usage properties — never user content,
 * credentials, or direct PII. Account-linked product events may use an opaque
 * user id unless the user selects anonymous sharing. That contract is the
 * caller's responsibility; core just moves events to the registered sink.
 */

export type TelemetryPropertyValue = string | number | boolean

export interface TelemetryEvent {
  /** Event name, e.g. `'kon10_boot'` or `'studio_action'`. */
  name: string
  /** Allow-listed usage properties. `undefined` values are dropped. */
  properties?: Record<string, TelemetryPropertyValue | undefined>
}

export interface Telemetry {
  /** Queue an event. Must never throw — telemetry is best-effort. */
  capture(event: TelemetryEvent): void
  /** Flush any queued events. Resolves when the sink has done its best. */
  flush(): Promise<void>
}

/** The default `Telemetry`: every event is dropped. */
export const noopTelemetry: Telemetry = {
  capture() {},
  flush: async () => {},
}
