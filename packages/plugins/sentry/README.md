# @kon10/sentry

OpenTelemetry tracing for Kon10, backed by Sentry. Registers a `Tracer` (see `@kon10/core`'s tracing contract) so every CRUD operation in `operations.ts` and every hook invocation gets a span, reported through Sentry's OpenTelemetry integration — and, by default, every operation/hook error also becomes a Sentry Issue.

## Install

```bash
pnpm add @kon10/sentry
```

## When to use this package

Use `@kon10/sentry` when you want Kon10's built-in tracing (CRUD operations, hooks) to show up in Sentry's Performance/Tracing view. Kon10's tracer contract is OpenTelemetry-shaped, not Sentry-specific — this plugin is one possible backend; swapping it for a different OTel exporter later doesn't require touching your entities, hooks, or `@kon10/core` itself.

## Public API

- `sentryTracingPlugin(options?)` — the `Plugin` that calls `Sentry.init()` (unless `autoInit: false`) and registers the resulting tracer with the kernel.
- `sentryTracingPluginOptionsSchema` — the Zod schema backing the options above.

## Example

```ts
import { defineConfig } from '@kon10/core'
import { sentryTracingPlugin } from '@kon10/sentry'

export default defineConfig({
  plugins: [
    sentryTracingPlugin({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 1,
    }),
  ],
  // ...db, modules
})
```

If your app already calls `Sentry.init()` itself (e.g. for error monitoring outside Kon10), pass `autoInit: false` and this plugin only wires up the tracer:

```ts
sentryTracingPlugin({ autoInit: false })
```

By default, every error `withSpan` records (an operation or hook throwing) is reported to Sentry as an Issue, on top of being an errored span — that's `captureExceptions: true`, the default. Set it to `false` if you already capture these errors another way and don't want duplicate Issues:

```ts
sentryTracingPlugin({ dsn: process.env.SENTRY_DSN, captureExceptions: false })
```

## Operational notes

- Register `sentryTracingPlugin()` once in the Kon10 config; it registers the tracer during `onInit`, before `db.migrate()` runs.
- Without this plugin (or another one calling `cms.registerTracer()`), `cms.tracer` is a no-op — spans are created and discarded at zero cost.
- Span names follow `kon10.<operation>` (e.g. `kon10.find`, `kon10.create`) and `kon10.hook.<event>` (e.g. `kon10.hook.beforeCreate`) for hook invocations.
- `captureExceptions` only affects errors that surface through `withSpan` (operations and hooks). Uncaught exceptions/unhandled rejections elsewhere in the process are handled by Sentry's own default Node integrations once `Sentry.init()` has run, independent of this option.

## Related documentation

- [Root README](../../../README.md)
