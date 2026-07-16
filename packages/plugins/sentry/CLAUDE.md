# @kon10/sentry — Sentry Plugin

A backend-only **plugin** that implements the kernel's vendor-neutral tracer contract over Sentry via OpenTelemetry. This is the one place a concrete observability vendor is allowed to appear.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules and the tracer contract in `@kon10/core`.

## Owns

- **`sentryTracingPlugin()`** — `plugin.ts` (`sentryTracingPlugin`, `sentryTracingPluginOptionsSchema`, `SentryTracingPluginOptions`): a `Plugin` whose `onInit` calls `cms.registerTracer(...)` with a Sentry/OpenTelemetry-backed `Tracer` implementation.

## Why this is a plugin, not in core

Core defines the `Tracer`/`Span` contract and defaults to `noopTracer` — it must never import a vendor SDK. This package supplies the real implementation, keeping the vendor dependency at the edge. A different backend (Datadog, OTLP, …) would be a sibling plugin implementing the same contract.

## Conventions specific to sentry

- Options are Zod-first (`sentryTracingPluginOptionsSchema` → inferred type).
- Backend-only: no `studio` barrel, no UI.
- Everything vendor-specific stays here; nothing about Sentry leaks into core or other modules.

## Tests

`plugin.test.ts` via `node:test` against `dist/`.
