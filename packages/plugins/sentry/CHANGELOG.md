# @kon10/sentry

## 1.3.0

### Minor Changes

- 382e666: Add Sentry error/exception tracking and source-map upload.

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

## 1.2.0

## 1.1.0

## 1.0.3

### Patch Changes

- @kon10/core@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [edeab7e]
  - @kon10/core@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [6e7fe1c]
- Updated dependencies [fe180c5]
- Updated dependencies [5c52497]
- Updated dependencies [424296e]
  - @kon10/core@1.0.1

## 1.0.0

### Patch Changes

- @kon10/core@1.0.0
