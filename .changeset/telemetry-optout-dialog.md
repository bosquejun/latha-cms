---
'@kon10/core': patch
'@kon10/studio-sdk': patch
'@kon10/start': patch
---

feat(studio): opt-out first-login telemetry dialog

Add `mode: 'opt-out'` to `studio.telemetryNotice`, matching the opt-out posture:
telemetry is on by default, and the first-login dialog lets the user **Turn off**
(deny) or **Keep anonymous** (allow, no email). Dismissing keeps the default
(on, anonymous). `'notice'` (disclose only) and `'opt-in'` (Allow / No thanks)
remain. The playground uses `'opt-out'`.
