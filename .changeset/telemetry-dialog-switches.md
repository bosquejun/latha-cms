---
'@kon10/start': patch
---

feat(studio): put the telemetry opt-out switches in the first-login dialog

The `opt-out` first-login dialog now renders the same two switches as the
settings page — **Usage monitoring** and **Stay anonymous** — instead of
buttons, so a user can opt out (or share their email) right there. Extracted the
shared `TelemetryToggles` component (used by both `TelemetrySettings` and the
dialog); flipping a switch updates consent live without closing the dialog,
which dismisses via a "Done" button.
