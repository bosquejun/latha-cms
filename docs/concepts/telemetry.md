# Telemetry

Kon10 can collect **account-unlinked, opt-out usage telemetry** to help improve
the framework. It is provided by the
`@kon10/telemetry` plugin and ships **on by default in new apps** (the scaffold
includes it), sending to Kon10's shared PostHog project unless the operator
turns telemetry off.

## What's collected

Only allow-listed usage data — **never content, credentials, or direct PII**:

- **Technical** (`kon10_boot`, once per boot): plugin and Kon10 versions,
  environment, Node version, OS platform + architecture, container status,
  module/entity counts, allow-listed entity-kind counts, and whether cache or
  storage adapters are configured.
- **Product** (`studio_action`): which Studio **mutations** happen — the action
  name only (`create` / `update` / `remove` / `saveGlobal`). No account or user
  identifier, slug, document id, field value, or managed content is sent.

Events are keyed by the random `kon10.projectId` that `create-kon10-app`
stamps into the project's `package.json`. This keeps the identity available in
production and gives each generated project its own anonymous identity. Projects
created before this field existed fall back to an id in
`~/.config/kon10/telemetry.json` (or `$XDG_CONFIG_HOME`). Set
`KON10_TELEMETRY_INSTANCE_ID` to override either source.

Every event also carries `nodeEnv` from `NODE_ENV` and the installed
`kon10Version` (or `unknown` when either cannot be resolved), so environments
and framework-version adoption can be filtered separately. PostHog person
profiles and GeoIP enrichment are explicitly disabled for these events.

## Destination

The scaffold includes the opt-out plugin, which sends only to Kon10's shared
PostHog US Cloud project:

```ts
// kon10.config.ts
import { telemetryPlugin } from '@kon10/telemetry'

export default defineConfig({
  plugins: [telemetryPlugin()],   // included by the scaffold
})
```

## Opting out

There are two levels — deployment-wide (operator) and per-user (in the Studio).

**Deployment-wide.** Telemetry is suppressed entirely (the plugin stays a no-op,
sends nothing) when any of these hold:

- `KON10_DISABLE_TELEMETRY=1`
- `DO_NOT_TRACK=1` (the cross-tool standard)
- a CI environment (`CI`), or `NODE_ENV=test`
- `telemetryPlugin({ enabled: false })`

**Per-user, in the Studio.** Drop the ready-made settings page in and each user
gets a usage-sharing control:

```tsx
// src/studio/settings/telemetry.tsx
import { TelemetrySettings, defineSettingsConfig } from '@kon10/start'
export const config = defineSettingsConfig({ path: 'telemetry', label: 'Telemetry' })
export default TelemetrySettings
```

- **Share Studio actions** — turn the user's own product telemetry off. Product events for
  that user stop (the choice is mirrored to a cookie the server reads).

The first-login dialog supports three policies: `notice` discloses collection,
`opt-out` collects until the user turns it off, and `opt-in` sends no Studio
product events until the user explicitly chooses **Allow**.

Read or drive the same state anywhere with `useTelemetryConsent()`
(`status`, `grant`, `deny`). Deprecated anonymity fields remain temporarily as
always-anonymous no-ops for extension compatibility.

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
