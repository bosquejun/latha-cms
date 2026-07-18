# Error Tracking & Tracing (Sentry)

Kon10 ships a first-class **Sentry** integration for production debugging:
distributed **tracing**, **error/exception tracking** on both the server and the
browser, and **source-map upload** so minified stack traces resolve back to the
original TypeScript. All of it is opt-in and inert until you configure a DSN.

Like every observability concern in Kon10, the vendor lives at the edge. The
kernel (`@kon10/core`) defines three vendor-neutral contracts — `Tracer`, `Telemetry`,
and `ErrorReporter` — each with a no-op default and a `register*` seam. The
`@kon10/sentry` plugin fills the tracer and error-reporter seams; core never
imports a Sentry SDK.

## What you get

| Capability | Where | How |
|---|---|---|
| **Tracing** — a span per CRUD op and per hook | Server | `sentryTracingPlugin()` wires the kernel `Tracer` to Sentry via OpenTelemetry |
| **Server error tracking** — unexpected 500-class faults reported as Issues, tagged with entity/operation | Server (RPC + delivery API) | The runner (`@kon10/start`) reports through `cms.errorReporter`, which the plugin backs with `Sentry.captureException()` |
| **Browser error tracking** — Studio admin-UI crashes and client exceptions | Browser | `@kon10/sentry/browser` — `initSentryBrowser()` + `<SentryErrorBoundary>` |
| **Source maps (app bundle)** | Build | `@kon10/sentry/vite` — `sentrySourceMaps()` |
| **Source maps (published `@kon10/*` packages)** | Release | `pnpm sourcemaps:upload` (`@sentry/cli`) |

## Server: tracing + error tracking

Add the plugin to `kon10.config.ts`. Registering it turns on both tracing and
server-side exception reporting:

```ts
// kon10.config.ts
import { sentryTracingPlugin } from '@kon10/sentry'

export default defineConfig({
  plugins: [
    ...(process.env.SENTRY_DSN
      ? [sentryTracingPlugin({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV,
          tracesSampleRate: 1,
        })]
      : []),
  ],
})
```

- **`Sentry.init()`** runs on `onInit` (pass `autoInit: false` to reuse a client
  the host app already initialized).
- Alongside the tracer, the plugin registers an **`ErrorReporter`** over
  `Sentry.captureException()`. `@kon10/start` calls it for genuine faults in the
  **RPC dispatcher** and the **delivery API**, tagged with `surface`, `slug`, and
  the operation. Pass **`captureErrors: false`** to register the tracer only.

**Expected control flow is never reported.** Access denials
(`AccessDeniedError` → 403) and validation failures (`ZodError` → 400/422) are
the system working as designed — they are logged and returned to the caller, but
kept out of Sentry so they don't bury real bugs.

## Browser: Studio error tracking

The server plugin covers server errors; `@kon10/sentry/browser` covers the
browser. Wire it once in your app root (e.g. TanStack Start's `__root.tsx`) —
`@sentry/react` never enters a server bundle because it lives on a separate
subpath.

```tsx
import { initSentryBrowser, SentryErrorBoundary } from '@kon10/sentry/browser'

// A no-op unless a DSN is set, so it's safe to call unconditionally.
initSentryBrowser({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE,
})

function Root() {
  return (
    <SentryErrorBoundary>
      <Kon10Provider /* … */>{/* … */}</Kon10Provider>
    </SentryErrorBoundary>
  )
}
```

`initSentryBrowser` is a no-op without a `dsn`; guard on `import.meta.env.PROD`
too if you don't want dev noise. `<SentryErrorBoundary>` reports render crashes
and shows a minimal fallback (override with the `fallback` prop).

## Source maps

Without uploaded source maps, the stack traces Sentry receives stay minified.
Two halves cover a deployed app.

### App bundle — `@kon10/sentry/vite`

```ts
// vite.config.ts
import { kon10Start } from '@kon10/start/vite'
import { sentrySourceMaps } from '@kon10/sentry/vite'

export default defineConfig({
  build: { sourcemap: true },              // required — no maps, nothing to upload
  plugins: [kon10Start(), viteReact(), ...sentrySourceMaps()],
})
```

A **no-op unless `SENTRY_AUTH_TOKEN` is set**, so local/dev builds are
unaffected and never fail. It reads `SENTRY_ORG`, `SENTRY_PROJECT`, and optional
`SENTRY_URL` from the environment (or pass them as options).

### Automating the release

You never have to hand-set a release. `@kon10/sentry/vite` exports
**`resolveSentryRelease()`**, which resolves — in order — an explicit value,
`SENTRY_RELEASE`, then the **git commit SHA**. Compute it once in
`vite.config.ts` (Node context, where git is reachable) and thread the *same*
value to the upload and the client, so the runtime and the uploaded maps always
agree:

```ts
// vite.config.ts
import { sentrySourceMaps, resolveSentryRelease } from '@kon10/sentry/vite'

const release = resolveSentryRelease()   // git SHA by default

export default defineConfig({
  build: { sourcemap: true },
  // Inject it so `import.meta.env.VITE_SENTRY_RELEASE` (read by
  // initSentryBrowser) is the exact value the maps upload under — no env needed.
  define: {
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release ?? ''),
  },
  plugins: [kon10Start(), viteReact(), ...sentrySourceMaps({ release })],
})
```

For the **server** plugin, set `SENTRY_RELEASE` at deploy time to that same
commit SHA (CI usually has it); the plugin defaults its release to
`process.env.SENTRY_RELEASE`. The playground does exactly this wiring — copy it.

### Published `@kon10/*` packages — `pnpm sourcemaps:upload`

Every package emits `.js.map` for its `dist/`. To de-minify a stack trace that
originates inside a Kon10 package running on the server, upload those maps as
part of your release:

```bash
SENTRY_AUTH_TOKEN=… SENTRY_ORG=… SENTRY_PROJECT=… SENTRY_RELEASE=… \
  pnpm build && pnpm sourcemaps:upload
```

The script (`scripts/upload-sourcemaps.mjs`) injects debug ids and uploads each
published package's `dist/` via `@sentry/cli`. With no auth token it is a
friendly no-op, so it's safe to wire into a pipeline unconditionally.

## Required environment

| Variable | Used by | Notes |
|---|---|---|
| `SENTRY_DSN` | server plugin | Enables `Sentry.init()` |
| `VITE_SENTRY_DSN` | browser | Client-exposed DSN (Vite inlines `VITE_*`) |
| `SENTRY_AUTH_TOKEN` | source-map upload | Project write + release scope; **without it, uploads are skipped** |
| `SENTRY_ORG` / `SENTRY_PROJECT` | source-map upload | Sentry org/project slugs |
| `SENTRY_RELEASE` | server runtime + upload | Optional — defaults to the git commit SHA via `resolveSentryRelease()`; set at deploy time for the server process |
| `VITE_SENTRY_RELEASE` | browser | Optional — inject it from `resolveSentryRelease()` in `vite.config.ts` (see above) rather than setting it by hand |
| `SENTRY_URL` | source-map upload | Optional — self-hosted Sentry base URL |

## How it fits

`@kon10/core` defines a vendor-neutral **`ErrorReporter`** contract
(`captureException(error, context)`) with a `noopErrorReporter` default and a
`cms.registerErrorReporter()` seam — the same shape as the `Tracer` and
`Telemetry` seams. `@kon10/sentry` registers a Sentry-backed reporter over it;
the runner reports through `cms.errorReporter`. Swapping Sentry for another
backend means writing a sibling plugin against the same contracts, not touching
the kernel.
