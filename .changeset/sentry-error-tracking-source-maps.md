---
"@kon10/core": minor
"@kon10/sentry": minor
"@kon10/start": minor
---

Add Sentry error/exception tracking and source-map upload.

- **`@kon10/core`**: new vendor-neutral `ErrorReporter` contract (`captureException`,
  `noopErrorReporter`) with a `cms.registerErrorReporter()` seam — the same
  shape as the `Tracer`/`Telemetry` seams. Core still imports no vendor SDK.
- **`@kon10/sentry`**: the server plugin now registers an `ErrorReporter` over
  `Sentry.captureException()` alongside the tracer (opt out with
  `captureErrors: false`). Two new entry points: `@kon10/sentry/browser`
  (`initSentryBrowser` + `<SentryErrorBoundary>` for the Studio, via
  `@sentry/react`) and `@kon10/sentry/vite` (`sentrySourceMaps()` to upload the
  app bundle's source maps, via `@sentry/vite-plugin`).
- **`@kon10/start`**: the RPC dispatcher and delivery API now report genuine
  500-class faults through `cms.errorReporter`, tagged with the entity and
  operation — while expected control flow (access denials, validation) is never
  reported.

Also adds a repo `sourcemaps:upload` script (`@sentry/cli`) that uploads every
published package's `dist/` source maps for a release, so server-side stack
traces from `@kon10/*` de-minify too.

The release identifier auto-derives from the git commit SHA — `@kon10/sentry/vite`
exports `resolveSentryRelease()` (explicit → `SENTRY_RELEASE` → git SHA), the
server plugin accepts a `release` (defaulting to `SENTRY_RELEASE`), and both the
Vite upload and the per-package script use the same default, so the runtime and
the uploaded maps agree without anyone hand-setting a release.
