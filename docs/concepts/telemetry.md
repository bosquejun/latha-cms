# Telemetry

Kon10 can collect **opt-out usage telemetry with per-user anonymity controls** — in the spirit of
Medusa and Next.js — to help improve the framework. It is provided by the
`@kon10/telemetry` plugin and ships **on by default in new apps** (the scaffold
includes it), but transmits nothing until a PostHog key is configured, and is
easy to turn off.

## What's collected

Only allow-listed usage data — **never content, credentials, or direct PII**:

- **Technical** (`kon10_boot`, once per boot): plugin telemetry version, Node
  version, OS platform + arch, and counts (`modules`, `entities`, whether a
  cache/storage adapter is configured).
- **Product** (`studio_action`): which Studio **mutations** happen — the action
  name only (`create` / `update` / `remove` / `saveGlobal`). No slugs, document
  ids, or field values. The authenticated account id is included by default;
  users can remove it with **Link to your account** in Telemetry settings.

Events are keyed by a random **anonymous instance id** persisted once to
`~/.config/kon10/telemetry.json` (or `$XDG_CONFIG_HOME`).

## Turning it on

The plugin is opt-out but **inert until you point it at a sink** — your own
PostHog project:

```ts
// kon10.config.ts
import { telemetryPlugin } from '@kon10/telemetry'

export default defineConfig({
  plugins: [telemetryPlugin()],   // included by the scaffold
})
```

```bash
# .env — set your PostHog project key (and host, if self-hosted)
KON10_TELEMETRY_POSTHOG_KEY=phc_xxx
KON10_TELEMETRY_POSTHOG_HOST=https://us.i.posthog.com   # default
```

Or pass them explicitly: `telemetryPlugin({ posthog: { key, host } })`.

## Opting out

There are two levels — deployment-wide (operator) and per-user (in the Studio).

**Deployment-wide.** Telemetry is suppressed entirely (the plugin stays a no-op,
sends nothing) when any of these hold:

- `KON10_DISABLE_TELEMETRY=1`
- `DO_NOT_TRACK=1` (the cross-tool standard)
- a CI environment (`CI`), or `NODE_ENV=test`
- `telemetryPlugin({ enabled: false })`
- no PostHog key is configured

**Per-user, in the Studio.** Drop the ready-made settings page in and each user
gets two toggles:

```tsx
// src/studio/settings/telemetry.tsx
import { TelemetrySettings, defineSettingsConfig } from '@kon10/start'
export const config = defineSettingsConfig({ path: 'telemetry', label: 'Telemetry' })
export default TelemetrySettings
```

- **Usage monitoring** — turn the user's own telemetry off. Product events for
  that user stop (the choice is mirrored to a cookie the server reads).
- **Link to your account** — on by default; turn it off to omit the user's
  account id and share Studio events anonymously.

The first-login dialog supports three policies: `notice` discloses collection,
`opt-out` collects until the user turns it off, and `opt-in` sends no Studio
product events until the user explicitly chooses **Allow**.

Read or drive the same state anywhere with `useTelemetryConsent()`
(`status`, `anonymous`, `grant`, `deny`, `setAnonymous`).

On first run (per machine) the plugin logs a one-time disclosure noting that
telemetry is on and how to disable it. Pair it with the Studio's
[`studio.telemetryNotice`](../studio-extensions.md#telemetry-disclosure-opt-out--opt-in)
to disclose it in the UI too.

> Instance-level technical events (`kon10_boot`) aren't tied to a user, so a
> per-user toggle doesn't affect them — use the deployment-wide opt-out for those.

## How it fits

`@kon10/core` defines a vendor-neutral `Telemetry` contract (`capture` / `flush`)
with a `noopTelemetry` default and a `cms.registerTelemetry()` seam — the same
shape as the tracer. `@kon10/telemetry` registers a PostHog sink over that seam;
the runner emits product events through `cms.telemetry`. Core never imports a
vendor SDK.
