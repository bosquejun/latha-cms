---
"@kon10/telemetry": patch
"create-kon10-app": patch
---

Send account-unlinked framework telemetry to Kon10's shared PostHog US Cloud
project by default, while preserving destination overrides and every existing
operator opt-out. Add the telemetry package to Kon10's fixed release group so
its version remains synchronized with `@kon10/core` and the other first-party
runtime packages.
