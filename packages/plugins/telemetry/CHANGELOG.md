# @kon10/telemetry

## 1.4.1

## 1.4.0

### Minor Changes

- 0423039: Make framework usage telemetry account-unlinked: Studio events no longer include
  user identifiers, and the account-linking control is removed. New projects get a
  stable project telemetry UUID, while events include the Kon10 version and
  environment. Boot telemetry adds only low-risk container and entity-kind counts.

### Patch Changes

- a716350: Send account-unlinked framework telemetry to Kon10's shared PostHog US Cloud
  project while preserving every existing operator opt-out. Add the telemetry
  package to Kon10's fixed release group so
  its version remains synchronized with `@kon10/core` and the other first-party
  runtime packages. Store the generated project identity as `kon10.projectId`,
  while retaining read compatibility with the earlier `telemetryId` field.

## 1.0.1

### Patch Changes

- 424296e: feat(telemetry): anonymous, opt-out usage analytics (PostHog)

  Add account-unlinked framework telemetry — **on by default**
  (the scaffold includes it), **anonymous**, and **opt-out**.

  - `@kon10/core` — a vendor-neutral `Telemetry` contract (`capture` / `flush`)
    with a `noopTelemetry` default and a `cms.telemetry` / `registerTelemetry()`
    seam, mirroring the tracer. Core never imports a vendor SDK.
  - `@kon10/telemetry` (new) — `telemetryPlugin()`: a PostHog sink over that seam
    (batched HTTP, no SDK dependency), a persisted anonymous instance id
    (`~/.config/kon10/telemetry.json`), a technical `kon10_boot` event, and a
    one-time first-run disclosure. Opt-out via `KON10_DISABLE_TELEMETRY`,
    `DO_NOT_TRACK`, CI, `NODE_ENV=test`, or `enabled: false`; inert until a PostHog
    shared ingestion destination is enabled.
  - `@kon10/start` — emits an anonymous `studio_action` product event (action name
    only) on Studio mutations through `cms.telemetry`.

  Only anonymous, non-identifying data is collected — never content, credentials,
  or PII. The scaffold template and playground enable the plugin by default.

- Updated dependencies [6e7fe1c]
- Updated dependencies [fe180c5]
- Updated dependencies [5c52497]
- Updated dependencies [424296e]
  - @kon10/core@1.0.1
