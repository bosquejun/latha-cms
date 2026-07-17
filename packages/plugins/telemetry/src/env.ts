/**
 * Opt-out resolution. Telemetry is disabled when any of the well-known signals
 * say so — `KON10_DISABLE_TELEMETRY`, the cross-tool `DO_NOT_TRACK`, a CI
 * environment, or a test run. Anything that isn't clearly "off" counts as on.
 */

type Env = Record<string, string | undefined>

/** A value is "on" unless it's absent/empty/`0`/`false`. */
function truthy(value: string | undefined): boolean {
  if (value == null) return false
  const v = value.trim().toLowerCase()
  return v !== '' && v !== '0' && v !== 'false' && v !== 'no'
}

/**
 * Whether telemetry should be suppressed for this process. Respects
 * `KON10_DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `CI`, and `NODE_ENV=test`.
 */
export function isTelemetryDisabled(env: Env = process.env): boolean {
  return (
    truthy(env.KON10_DISABLE_TELEMETRY) ||
    truthy(env.DO_NOT_TRACK) ||
    truthy(env.CI) ||
    env.NODE_ENV === 'test'
  )
}
