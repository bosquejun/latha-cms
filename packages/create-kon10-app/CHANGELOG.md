# create-kon10-app

## 0.2.0

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

## 0.1.1

### Patch Changes

- edeab7e: Make Studio telemetry consent enforcement match the configured notice mode,
  keep per-user browser preferences synchronized, and scaffold the complete
  first-login opt-out and telemetry settings experience.
