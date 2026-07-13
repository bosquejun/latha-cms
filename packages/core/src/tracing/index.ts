/**
 * Minimal tracing contract + no-op default.
 *
 * Shaped to match `@opentelemetry/api`'s `Tracer`/`Span` (a real OTel tracer
 * satisfies this directly), so core stays dependency-free while
 * `operations.ts` and the hook engine emit spans unconditionally — a no-op
 * tracer costs nothing, and a real one (e.g. wired up by `@kon10/sentry`)
 * gets a span per CRUD operation and per hook for free. Span status codes
 * mirror OTel's `SpanStatusCode` enum values (0/1/2) so passing them straight
 * through to a real OTel span works unchanged.
 */

export const SpanStatusCode = {
  UNSET: 0,
  OK: 1,
  ERROR: 2,
} as const

export type SpanStatusCode = (typeof SpanStatusCode)[keyof typeof SpanStatusCode]

export interface SpanStatus {
  code: SpanStatusCode
  message?: string
}

export type SpanAttributeValue = string | number | boolean

export interface Span {
  setAttribute(key: string, value: SpanAttributeValue): Span
  setAttributes(attributes: Record<string, SpanAttributeValue>): Span
  recordException(exception: unknown): void
  setStatus(status: SpanStatus): Span
  end(): void
}

export interface Tracer {
  /** Run `fn` inside a new span named `name`, ending it when `fn` settles. */
  startActiveSpan<T>(name: string, fn: (span: Span) => T): T
}

const noopSpan: Span = {
  setAttribute: () => noopSpan,
  setAttributes: () => noopSpan,
  recordException: () => {},
  setStatus: () => noopSpan,
  end: () => {},
}

/** The default `Tracer`: every span is a no-op. */
export const noopTracer: Tracer = {
  startActiveSpan: (_name, fn) => fn(noopSpan),
}

/**
 * Run `fn` inside a span: record a thrown error (`recordException` + `ERROR`
 * status) before rethrowing, and always end the span. `operations.ts` and the
 * hook engine share this so every instrumented call site behaves the same way
 * on failure.
 */
export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      return await fn(span)
    } catch (error) {
      span.recordException(error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    } finally {
      span.end()
    }
  })
}
