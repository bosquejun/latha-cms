---
"@kon10/telemetry": patch
"create-kon10-app": patch
---

Send account-unlinked framework telemetry to Kon10's shared PostHog US Cloud
project while preserving every existing operator opt-out. Add the telemetry
package to Kon10's fixed release group so
its version remains synchronized with `@kon10/core` and the other first-party
runtime packages. Store the generated project identity as `kon10.projectId`,
while retaining read compatibility with the earlier `telemetryId` field.
