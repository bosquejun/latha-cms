/**
 * Telemetry contract + no-op default.
 *
 * A minimal, vendor-neutral event sink — the same shape of seam as the tracer:
 * core defines the contract and ships a no-op, and a plugin (`@kon10/telemetry`)
 * registers a real sink (PostHog). The kernel and runners emit events through
 * `cms.telemetry` unconditionally; a no-op costs nothing.
 *
 * Events carry only anonymous, non-identifying properties — never user content,
 * credentials, or PII. That contract is the caller's responsibility; core just
 * moves events to whatever sink is registered.
 */

export type TelemetryPropertyValue = string | number | boolean

export interface TelemetryEvent {
  /** Event name, e.g. `'kon10_boot'` or `'studio_action'`. */
  name: string
  /** Anonymous, non-identifying properties. `undefined` values are dropped. */
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
