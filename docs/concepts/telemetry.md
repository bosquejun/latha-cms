# Telemetry

Kon10 can collect **anonymous, opt-out** usage telemetry — in the spirit of
Medusa and Next.js — to help improve the framework. It is provided by the
`@kon10/telemetry` plugin and ships **on by default in new apps** (the scaffold
includes it), but transmits nothing until a PostHog key is configured, and is
easy to turn off.

## What's collected

Only anonymous, non-identifying data — **never content, credentials, or PII**:

- **Technical** (`kon10_boot`, once per boot): plugin telemetry version, Node
  version, OS platform + arch, and counts (`modules`, `entities`, whether a
  cache/storage adapter is configured).
- **Product** (`studio_action`): which Studio **mutations** happen — the action
  name only (`create` / `update` / `remove` / `saveGlobal`). No slugs, ids, field
  values, or user identity.

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

Telemetry is suppressed (the plugin stays a no-op, sends nothing) when any of
these hold:

- `KON10_DISABLE_TELEMETRY=1`
- `DO_NOT_TRACK=1` (the cross-tool standard)
- a CI environment (`CI`), or `NODE_ENV=test`
- `telemetryPlugin({ enabled: false })`
- no PostHog key is configured

On first run (per machine) the plugin logs a one-time disclosure noting that
telemetry is on and how to disable it. Pair it with the Studio's
[`studio.telemetryNotice`](../studio-extensions.md#telemetry-disclosure--anonymous-tracking-opt-in)
to disclose it in the UI too.

## How it fits

`@kon10/core` defines a vendor-neutral `Telemetry` contract (`capture` / `flush`)
with a `noopTelemetry` default and a `cms.registerTelemetry()` seam — the same
shape as the tracer. `@kon10/telemetry` registers a PostHog sink over that seam;
the runner emits product events through `cms.telemetry`. Core never imports a
vendor SDK.
