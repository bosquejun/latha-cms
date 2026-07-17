---
'@kon10/core': minor
'@kon10/studio-sdk': minor
'@kon10/start': minor
---

feat(studio): per-user telemetry opt-out toggles

Add an in-Studio control surface for telemetry, not just env vars:

- A ready-made **Telemetry settings page** (`TelemetrySettings` from
  `@kon10/start`) with two switches — **Usage monitoring** (on/off) and **Stay
  anonymous** (attach email or not). Drop it in via
  `src/studio/settings/telemetry.tsx`.
- `useTelemetryConsent()` now carries `anonymous` + `setAnonymous` alongside
  `status`/`grant`/`deny`, persisted per-user and mirrored to cookies
  (`kon10_tm_consent`, `kon10_tm_anon`).
- `@kon10/start` honors those cookies server-side: it skips the `studio_action`
  product event when a user has turned monitoring off, and attaches their email
  only when they've turned anonymity off.

The first-login dialog (`studio.telemetryNotice`) now discloses the opt-out and
gains a `manageUrl` — when set, it shows a "Manage" button that navigates to the
telemetry settings page so users can find the toggles on first login.

Deployment-wide opt-out (`KON10_DISABLE_TELEMETRY` / `DO_NOT_TRACK`) still
disables everything, including instance-level technical events.
