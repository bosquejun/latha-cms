# @kon10/core

## 1.2.0

### Minor Changes

- fb70658: Rename the kernel package from the scoped `@kon10/core` to the unscoped `kon10`. The package now publishes as `kon10`; import the kernel via `import { ... } from 'kon10'` instead of `'@kon10/core'`, and depend on `kon10` in `package.json`. All workspace packages have been updated to the new specifier. Other `@kon10/*` package names are unchanged.

## 1.1.0

### Minor Changes

- c02eeef: refactor(storage): consolidate the DB adapters onto Kysely, with query-level analytics

  Both `DBAdapter` implementations now run on a single shared adapter
  (`KyselyAdapter`) built on [Kysely](https://kysely.dev). Because Kon10 entities
  are declared at runtime there is no static schema, so the adapter uses Kysely's
  dynamic mode (`Kysely<any>` + `db.dynamic.ref`) and builds every query from the
  runtime `TablePlan`. The upshot: the query, pagination, and reconciliation logic
  that used to be written twice — once per adapter, with hand-assembled `?`/`$n`
  SQL strings — is now written once, and Kysely renders the dialect-correct SQL.

  - `tursoAdapter` uses Turso's first-party `@libsql/kysely-libsql` dialect.
  - `postgresAdapter` uses Kysely's official `PostgresDialect` over the `pg`
    driver, replacing the previous `postgres` (porsager) driver.

  The migration contract is unchanged: `schema/generator.ts` still owns the
  additive DDL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`, never
  drop/retype; warn on drift) — Kysely only _executes_ those strings. Live-column
  introspection is unified through Kysely's `introspection.getTables()`, replacing
  the separate SQLite `PRAGMA` and Postgres `information_schema` queries. Value
  marshaling stays dialect-specific, as the driver storage shapes differ.

  **Analytics.** `@kon10/core`'s `DBAdapter` gains an optional `tracer` seam,
  which the kernel assigns during boot (after plugin `onInit`, so a plugin-
  registered tracer such as `@kon10/sentry`'s is the one the adapter sees). The
  adapter wraps each DB round-trip in a `kon10.db.*` span — a finer child of the
  operation-level `kon10.find` / `kon10.create` / … spans, isolating query time
  from access/hook/validation time. With the default `noopTracer` it costs
  nothing. Adding the field is backward compatible: it is optional, so existing
  `DBAdapter` implementations are unaffected.

  **Breaking (Postgres):** `PostgresAdapterOptions` drops the porsager-specific
  `prepare` option. `pg` uses unnamed prepared statements, which are already
  compatible with Supabase's transaction pooler (pgBouncer), so no replacement is
  needed.

## 1.0.3

## 1.0.2

### Patch Changes

- edeab7e: Make Studio telemetry consent enforcement match the configured notice mode,
  keep per-user browser preferences synchronized, and scaffold the complete
  first-login opt-out and telemetry settings experience.

## 1.0.1

### Patch Changes

- 6e7fe1c: feat(studio): config-driven branding + modern login screen

  Branding is now declared once in `kon10.config.ts` under a new `studio.branding`
  block and applies to both the Studio shell and a redesigned `/login` screen:

  ```ts
  studio: {
    branding: {
      appName: 'Acme CMS',
      logo: '/logo.svg',
      loginTitle: 'Sign in to Acme',
      loginSubtitle: 'Manage your content and media.',
      tagline: 'Ship content faster.',
      taglineSubtitle: 'One Studio for your whole team.',
    },
  }
  ```

  - `@kon10/core` — `Kon10Config` gains a `studio?: { branding?: StudioBrandingConfig }`
    passthrough (serializable; the kernel never reads it, same contract as `studioPath`).
  - `@kon10/start` — the `kon10Start()` Vite plugin lifts `studio.branding` into a new
    client-safe `virtual:kon10/studio-config` module (mirroring `virtual:kon10/studio-extensions`).
    The `/login` screen is redesigned as a modern, minimal centered card over a
    branded backdrop (logo above a single form card with password show/hide and an
    inline error alert). `Kon10Logo` and `resolveBrandLogo` are exported.
  - `@kon10/studio-sdk` — `<Kon10Provider>` accepts a `branding` prop
    (`Kon10Branding`), threaded through to the login screen and the shell
    (`StudioShell` / top nav / mobile menu gain an optional `logo`). The prop's
    `logo` accepts either an image URL (as from config) or a `ReactNode` override.

  Every field is optional and defaults to the Kon10 mark and copy, so existing apps
  render the new default branding with no changes. The scaffold template wires
  `branding={studioConfig.branding}` out of the box.

  Beyond branding, the login screen is customizable two more ways:

  - **Sign-up button** — set `studio.branding.signUpUrl` to show a "Sign up"
    action on the login screen linking there; omit it and no button renders.
  - **Login zones** — new `login.aside`, `login.header`, `login.form.before`,
    `login.form.after`, and `login.footer` injection zones let widgets drop into
    the stock (pre-auth) sign-in screen (e.g. a "forgot password?" link) via the
    existing `src/studio/widgets/` extension system.
  - **Full override** — `kon10Start({ loginPath: false })` skips the built-in
    login route so the app can own `src/routes/login.tsx` (reuse `<Kon10Login>` or
    build a bespoke page with `client.login()`); the Studio route and extension
    discovery are unaffected.

  The Studio also gains an optional, one-time **telemetry dialog** on first
  sign-in (`studio.telemetryNotice`, carried client-side via
  `virtual:kon10/studio-config`), in two modes:

  - `mode: 'notice'` (default) — a disclosure with an acknowledge button;
    informational only, never gates telemetry.
  - `mode: 'opt-in'` — asks consent for anonymous tracking (Allow / No thanks).
    The per-user choice is recorded (in `localStorage`) and exposed via
    `useTelemetryConsent()` / `getTelemetryConsent()` / `TelemetryConsentProvider`,
    so operators gate their own analytics on a `'granted'` consent. Kon10 collects
    nothing itself.

- fe180c5: feat(studio): opt-out first-login telemetry dialog

  Add `mode: 'opt-out'` to `studio.telemetryNotice`, matching the opt-out posture:
  telemetry is on by default, and the first-login dialog lets the user **Turn off**
  (deny) or **Keep anonymous** (allow, no email). Dismissing keeps the default
  (on, anonymous). `'notice'` (disclose only) and `'opt-in'` (Allow / No thanks)
  remain. The playground uses `'opt-out'`.

- 5c52497: feat(studio): per-user telemetry opt-out toggles

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

- 424296e: feat(telemetry): anonymous, opt-out usage analytics (PostHog)

  Add framework telemetry in the spirit of Medusa/Next.js — **on by default**
  (the scaffold includes it), **anonymous**, and **opt-out**.

  - `@kon10/core` — a vendor-neutral `Telemetry` contract (`capture` / `flush`)
    with a `noopTelemetry` default and a `cms.telemetry` / `registerTelemetry()`
    seam, mirroring the tracer. Core never imports a vendor SDK.
  - `@kon10/telemetry` (new) — `telemetryPlugin()`: a PostHog sink over that seam
    (batched HTTP, no SDK dependency), a persisted anonymous instance id
    (`~/.config/kon10/telemetry.json`), a technical `kon10_boot` event, and a
    one-time first-run disclosure. Opt-out via `KON10_DISABLE_TELEMETRY`,
    `DO_NOT_TRACK`, CI, `NODE_ENV=test`, or `enabled: false`; inert until a PostHog
    key (`KON10_TELEMETRY_POSTHOG_KEY`) is configured.
  - `@kon10/start` — emits an anonymous `studio_action` product event (action name
    only) on Studio mutations through `cms.telemetry`.

  Only anonymous, non-identifying data is collected — never content, credentials,
  or PII. The scaffold template and playground enable the plugin by default.

## 1.0.0
