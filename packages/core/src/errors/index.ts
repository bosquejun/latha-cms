/**
 * Error-reporter contract + no-op default.
 *
 * A minimal, vendor-neutral exception sink — the same shape of seam as the
 * tracer and telemetry: core defines the contract and ships a no-op, and a
 * plugin (`@kon10/sentry`) registers a real reporter over its SDK
 * (`Sentry.captureException`). The kernel and runners report genuine,
 * unexpected failures through `cms.errorReporter` unconditionally; a no-op
 * costs nothing.
 *
 * This is for *unexpected* errors worth a human's attention (500-class
 * failures) — not expected control flow like access denials or validation
 * errors, which callers filter out before reporting. `captureException` must
 * never throw: reporting is best-effort and must not mask the original error.
 */

/** How severe a reported exception is. Maps onto Sentry's severity levels. */
export type ErrorSeverity = 'fatal' | 'error' | 'warning'

export interface ErrorReportContext {
  /** Severity of the report. Defaults to `'error'` at the sink. */
  severity?: ErrorSeverity
  /**
   * String tags for grouping/filtering in the backend (e.g.
   * `{ surface: 'rpc', action: 'create', slug: 'posts' }`). Never user content
   * or credentials — the caller is responsible for what it passes.
   */
  tags?: Record<string, string>
  /** Extra structured diagnostic context. Same non-PII contract as `tags`. */
  extra?: Record<string, unknown>
}

export interface ErrorReporter {
  /**
   * Report an unexpected exception. Must never throw — reporting is
   * best-effort and must not shadow the error being reported.
   */
  captureException(error: unknown, context?: ErrorReportContext): void
}

/** The default `ErrorReporter`: every exception is dropped. */
export const noopErrorReporter: ErrorReporter = {
  captureException() {},
}

let clientErrorReporter: ErrorReporter = noopErrorReporter

/**
 * Register the browser-side exception sink used by framework-neutral client
 * code. Browser monitoring plugins call this during their initialization.
 */
export function registerClientErrorReporter(reporter: ErrorReporter): void {
  clientErrorReporter = reporter
}

/** Report a handled client exception without coupling UI packages to a vendor. */
export function reportClientError(
  error: unknown,
  context?: ErrorReportContext,
): void {
  clientErrorReporter.captureException(error, context)
}
