# @kon10/telemetry

## 2.0.0

### Minor Changes

- 424296e: feat(telemetry): anonymous, opt-out usage analytics (PostHog)

  Add framework telemetry in the spirit of Medusa/Next.js — **on by default**
  (the scaffold includes it), **anonymous**, and **opt-out**.

  - `@kon10/core` — a vendor-neutral `Telemetry` contract (`capture` / `flush`)
    with a `noopTelemetry` default and a `cms.telemetry` / `registerTelemetry()`
    seam, mirroring the tracer. Core never imports a vendor SDK.
  - `@kon10/telemetry` (new) — `telemetryPlugin()`: a PostHog sink over that seam
    (batched HTTP, no SDK dependency), a persisted anonymous instance id
    (`~/.config/kon10/telemetry.json`), a technical `kon10_boot` event, and a
    one-time first-run disclosure. Opt-out via `KON10_DISABLE_TELEMETRY`,
    `DO_NOT_TRACK`, CI, `NODE_ENV=test`, or `enabled: false`; inert until a PostHog
    key (`KON10_TELEMETRY_POSTHOG_KEY`) is configured.
  - `@kon10/start` — emits an anonymous `studio_action` product event (action name
    only) on Studio mutations through `cms.telemetry`.

  Only anonymous, non-identifying data is collected — never content, credentials,
  or PII. The scaffold template and playground enable the plugin by default.

### Patch Changes

- Updated dependencies [6e7fe1c]
- Updated dependencies [fe180c5]
- Updated dependencies [5c52497]
- Updated dependencies [424296e]
  - @kon10/core@2.0.0
