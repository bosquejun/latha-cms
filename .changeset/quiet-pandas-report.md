---
"@kon10/telemetry": minor
"@kon10/start": minor
"@kon10/studio-sdk": minor
"create-kon10-app": minor
---

Make framework usage telemetry account-unlinked: Studio events no longer include
user identifiers, and the account-linking control is removed. New projects get a
stable project telemetry UUID, while events include the Kon10 version and
environment. Boot telemetry adds only low-risk container and entity-kind counts.
The plugin now sends to Kon10's shared PostHog project by default while retaining
destination overrides and all existing opt-outs.
