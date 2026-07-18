# @kon10/sentry — Sentry Plugin

The **plugin** that implements the kernel's vendor-neutral observability contracts over Sentry — tracing (via OpenTelemetry) and error reporting — plus browser-side error tracking and build-time source-map upload. This is the one place a concrete observability vendor is allowed to appear.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules and the `Tracer`/`ErrorReporter` contracts in `@kon10/core`, and [`docs/concepts/error-tracking.md`](../../../docs/concepts/error-tracking.md) for the product-facing guide.

## Owns

Three entry points, one per consumption surface:

- **`.` (server)** — `plugin.ts` (`sentryTracingPlugin`, `sentryTracingPluginOptionsSchema`, `SentryTracingPluginOptions`): a `Plugin` whose `onInit` calls `cms.registerTracer(...)` with a Sentry/OpenTelemetry-backed `Tracer`, **and** (unless `captureErrors: false`) `cms.registerErrorReporter(...)` with an `ErrorReporter` over `Sentry.captureException()`. Backend only (`@sentry/node`).
- **`./browser`** — `browser.tsx` (`initSentryBrowser`, `SentryErrorBoundary`, `sentryBrowserOptionsSchema`): client-side init + a React error boundary for the Studio, over `@sentry/react`. Separate subpath so React / `@sentry/react` never reach a server bundle.
- **`./vite`** — `vite.ts` (`sentrySourceMaps`): wraps `@sentry/vite-plugin` to upload the app bundle's source maps. A no-op without `SENTRY_AUTH_TOKEN`.

## Why this is a plugin, not in core

Core defines the `Tracer`/`Span` and `ErrorReporter` contracts and defaults to `noopTracer` / `noopErrorReporter` — it must never import a vendor SDK. This package supplies the real implementations, keeping the vendor dependency at the edge. A different backend (Datadog, OTLP, …) would be a sibling plugin implementing the same contracts.

## Conventions specific to sentry

- Options are Zod-first (`*OptionsSchema` → inferred type).
- **Server ↔ browser split is load-bearing**: `@sentry/node` stays on `.`, `@sentry/react` + React on `./browser`. Never import one from the other.
- The error reporter's `captureException` must **never throw** — a reporting failure must not shadow the error being reported.
- Everything vendor-specific stays here; nothing about Sentry leaks into core, `@kon10/start`, or other modules. `@kon10/start` only ever touches the neutral `cms.errorReporter` seam.

## Tests

`plugin.test.ts` via `node:test` against `dist/` (server plugin: tracer + error-reporter registration).
