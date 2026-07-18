/**
 * Browser-side Sentry wiring for the Studio (and any client build).
 *
 * The backend plugin (`sentryTracingPlugin`) covers server errors; this entry
 * covers the *browser* — Studio admin-UI crashes and client-side exceptions.
 * It is a separate subpath (`@kon10/sentry/browser`) so backend-only consumers
 * never pull `@sentry/react` or React into a server bundle.
 *
 *   // app root (e.g. TanStack Start __root.tsx), client only
 *   import { initSentryBrowser, SentryErrorBoundary } from '@kon10/sentry/browser'
 *
 *   if (import.meta.env.PROD) {
 *     initSentryBrowser({ dsn: import.meta.env.VITE_SENTRY_DSN })
 *   }
 *
 *   <SentryErrorBoundary>
 *     <Kon10Provider …>{…}</Kon10Provider>
 *   </SentryErrorBoundary>
 *
 * Source maps uploaded by `@kon10/sentry/vite` (matched on the same `release`)
 * turn the minified stack traces these report back into original TS.
 */

import * as Sentry from '@sentry/react'
import { registerClientErrorReporter } from '@kon10/core'
import { z } from 'zod'
import type { ReactElement, ReactNode } from 'react'

export const sentryBrowserOptionsSchema = z.object({
  /** Sentry DSN. When omitted `init` is a no-op — safe to call unconditionally. */
  dsn: z.string().optional(),
  environment: z.string().optional(),
  /** Release identifier — match `@kon10/sentry/vite`'s `release` to resolve source maps. */
  release: z.string().optional(),
  /** Fraction of traces sent, 0–1. Defaults to 0 (no browser performance tracing). */
  tracesSampleRate: z.number().min(0).max(1).optional(),
  /** Enable `browserTracingIntegration()` for page-load/navigation spans. Defaults to `false`. */
  browserTracing: z.boolean().optional(),
})

export type SentryBrowserOptions = z.infer<typeof sentryBrowserOptionsSchema>

/**
 * Initialize the browser Sentry SDK. A no-op when no `dsn` is set, so callers
 * can invoke it unconditionally (guarding on `import.meta.env.PROD` is still
 * recommended so dev noise never reaches Sentry). Call once, at module load in
 * the app root, before rendering.
 */
export function initSentryBrowser(options: SentryBrowserOptions = {}): void {
  const opts = sentryBrowserOptionsSchema.parse(options)
  if (!opts.dsn) return
  Sentry.init({
    dsn: opts.dsn,
    environment: opts.environment,
    release: opts.release,
    tracesSampleRate: opts.tracesSampleRate ?? 0,
    integrations: opts.browserTracing ? [Sentry.browserTracingIntegration()] : [],
  })
  registerClientErrorReporter({
    captureException(error, context) {
      Sentry.captureException(error, {
        level: context?.severity ?? 'error',
        tags: context?.tags,
        extra: context?.extra,
      })
    },
  })
}

/**
 * A React error boundary that reports render crashes to Sentry and shows a
 * minimal fallback. Wrap the Studio (or the whole app) with it. When Sentry was
 * never initialized (no DSN) it still works as a plain boundary — the capture
 * is simply dropped.
 */
export function SentryErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode
  /** Replaces the default fallback UI shown after a crash. */
  fallback?: ReactElement
}) {
  return (
    <Sentry.ErrorBoundary
      fallback={
        fallback ?? (
          <div role="alert" style={{ padding: '2rem', font: '14px system-ui, sans-serif' }}>
            Something went wrong. The error has been reported.
          </div>
        )
      }
    >
      {children}
    </Sentry.ErrorBoundary>
  )
}
