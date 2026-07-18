# @kon10/start

## 1.3.0

### Minor Changes

- 382e666: Add Sentry error/exception tracking and source-map upload.

  - **`@kon10/core`**: new vendor-neutral `ErrorReporter` contract (`captureException`,
    `noopErrorReporter`) with a `cms.registerErrorReporter()` seam — the same
    shape as the `Tracer`/`Telemetry` seams. Core still imports no vendor SDK.
  - **`@kon10/sentry`**: the server plugin now registers an `ErrorReporter` over
    `Sentry.captureException()` alongside the tracer (opt out with
    `captureErrors: false`). Two new entry points: `@kon10/sentry/browser`
    (`initSentryBrowser` + `<SentryErrorBoundary>` for the Studio, via
    `@sentry/react`) and `@kon10/sentry/vite` (`sentrySourceMaps()` to upload the
    app bundle's source maps, via `@sentry/vite-plugin`).
  - **`@kon10/start`**: the RPC dispatcher and delivery API now report genuine
    500-class faults through `cms.errorReporter`, tagged with the entity and
    operation — while expected control flow (access denials, validation) is never
    reported.

  Also adds a repo `sourcemaps:upload` script (`@sentry/cli`) that uploads every
  published package's `dist/` source maps for a release, so server-side stack
  traces from `@kon10/*` de-minify too.

  The release identifier auto-derives from the git commit SHA — `@kon10/sentry/vite`
  exports `resolveSentryRelease()` (explicit → `SENTRY_RELEASE` → git SHA), the
  server plugin accepts a `release` (defaulting to `SENTRY_RELEASE`), and both the
  Vite upload and the per-package script use the same default, so the runtime and
  the uploaded maps agree without anyone hand-setting a release.

### Patch Changes

- @kon10/client@1.3.0

## 1.2.0

### Patch Changes

- @kon10/client@1.2.0

## 1.1.0

### Minor Changes

- 296f18a: feat: create the first admin at `/setup` instead of from environment variables

  A fresh install now sends you to a framework-owned `/setup` screen to create the
  admin account, rather than expecting `ADMIN_EMAIL`/`ADMIN_PASSWORD` with a
  plaintext password in the environment. Once an admin exists the route closes
  itself and redirects to `/login`, and `/login` redirects _to_ setup while the
  install is still empty — so a fresh deploy can't strand you on a sign-in form
  with no account to use.

  Setup is a capability of the subject store, not an assumption: `SubjectStore`
  gains optional `count()` and `create()`, and a store that omits them (an
  external IdP, which owns its own account creation) reports setup as unsupported
  rather than half-serving it. `entitySubjectStore` implements both through the
  kernel's generic operations, so `@kon10/auth` still takes no dependency on
  `@kon10/users`.

  In production `/setup` additionally requires a token derived as
  `HMAC(AUTH_SECRET, 'kon10:setup')`. Deriving rather than storing it means every
  serverless instance agrees without shared state, no new env var is needed, and
  it goes inert the moment a user exists — closing the window where an unattended
  public deploy stays claimable by whoever finds the URL first. Development
  requires no token, so first run stays frictionless.

  `ADMIN_EMAIL`/`ADMIN_PASSWORD` still work when **both** are set, as an opt-in
  fast path for automation (CI, E2E, throwaway environments).

  New public surface: `Kon10Setup` and `kon10Start({ setupPath })` in
  `@kon10/start`; `client.setupStatus()` / `client.setup()`, `setupPath`, the
  `setup.*` extension zones, and `setupTitle`/`setupSubtitle` branding in
  `@kon10/studio-sdk`; `setupRoute`, `setupStatusRoute`, `setupToken`, and
  `CreateSubjectInput` in `@kon10/auth`.

### Patch Changes

- 11e36ed: feat: layout-shaped loading skeletons on Studio pages

  Every auto-generated Studio page now shows a skeleton that mirrors its own
  layout while it waits on data, instead of a bare centered spinner — the page
  keeps its shape and no longer reflows when content lands.

  `@kon10/studio-sdk` gains four composable, CMS-aware skeletons built on the
  `@kon10/ui` `Skeleton` primitive: `ListSkeleton` (header + table rows),
  `FormSkeleton` (header + toolbar + field rows, optional sidebar),
  `DashboardSkeleton` (stat-card grid), and the shared `PageHeaderSkeleton`.
  `LoadingState` remains the generic fallback and the app-boot indicator.

  `@kon10/start` wires these into the built-in views — list, create, edit, and
  global forms render the matching skeleton, and edit/global forms derive their
  skeleton's field count and sidebar from the loaded entity descriptor. Dashboard
  stat tiles use a small inline skeleton in place of the `·` placeholder.
  `@kon10/auth`'s API Keys settings page swaps its spinner for a list skeleton.

  - @kon10/client@1.1.0

## 1.0.3

### Patch Changes

- @kon10/auth@1.0.3
- @kon10/client@1.0.3
- @kon10/content@1.0.3
- @kon10/core@1.0.3
- @kon10/studio-sdk@1.0.3
- @kon10/ui@1.0.3

## 1.0.2

### Patch Changes

- edeab7e: Make Studio telemetry consent enforcement match the configured notice mode,
  keep per-user browser preferences synchronized, and scaffold the complete
  first-login opt-out and telemetry settings experience.
- Updated dependencies [edeab7e]
  - @kon10/core@1.0.2
  - @kon10/studio-sdk@1.0.2
  - @kon10/auth@1.0.2
  - @kon10/client@1.0.2
  - @kon10/content@1.0.2
  - @kon10/ui@1.0.2

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

- de47700: feat(studio): put the telemetry opt-out switches in the first-login dialog

  The `opt-out` first-login dialog now renders the same two switches as the
  settings page — **Usage monitoring** and **Stay anonymous** — instead of
  buttons, so a user can opt out (or share their email) right there. Extracted the
  shared `TelemetryToggles` component (used by both `TelemetrySettings` and the
  dialog); flipping a switch updates consent live without closing the dialog,
  which dismisses via a "Done" button.

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

- Updated dependencies [6e7fe1c]
- Updated dependencies [fe180c5]
- Updated dependencies [5c52497]
- Updated dependencies [424296e]
  - @kon10/core@1.0.1
  - @kon10/studio-sdk@1.0.1
  - @kon10/auth@1.0.1
  - @kon10/client@1.0.1
  - @kon10/content@1.0.1
  - @kon10/ui@1.0.1

## 1.0.0

### Minor Changes

- 5324e33: Add the headless delivery client and a schema manifest endpoint.

  `@kon10/client` is a new framework-agnostic SDK over the public `/api/v1`
  content surface (`createDeliveryClient` with `list` / `get` / `single`,
  per-call Zod schemas, and a `DeliveryError` mapping of the response envelope),
  and `@kon10/client-react` adds `Kon10Provider` + `useList` / `useDoc` /
  `useSingle` hooks. The response-envelope contract (`apiResponseSchema`,
  `apiSuccess`, etc.) now lives in `@kon10/client` as the single source of truth
  shared with the server; `@kon10/start/envelope` re-exports it unchanged.

  `@kon10/start` adds `GET /api/v1/_manifest`, returning each readable entity's
  `prefix` / `slug` / `cardinality` / `kind` / `hierarchical` / `timestamps` and
  serialized (non-hidden) field configs — enough for a consumer or codegen to
  rebuild the document shapes the server validates. It is gated by the same read
  authorization as the entity's own reads.

- 8267925: Add publishable API keys (`rfcs/publishable-api-keys.md`).

  `@kon10/auth` gains two key classes distinguished by token prefix —
  `kon10_pk_` (publishable, safe to embed in client code) and `kon10_sk_`
  (secret, server-only); legacy `kon10_` tokens resolve as secret. The
  `api-keys` entity carries `type`, `allowedOrigins`, and `rateLimitPerMinute`;
  `ApiKeyPrincipal` exposes `publishable` and its guardrail config; and the RBAC
  guard caps publishable principals to read-only (unliftable, before any access
  predicate). New token helpers `apiKeyClassOf` / `PUBLISHABLE_TOKEN_PREFIX` /
  `SECRET_TOKEN_PREFIX` are exported.

  `@kon10/start` enforces the publishable-key guardrails on the delivery API and
  manifest: an origin allowlist (defense-in-depth) and a per-key fixed-window
  rate limit backed by the cache adapter, returning a new `429`
  `TOO_MANY_REQUESTS` envelope.

  `@kon10/client` throws if a secret key (`kon10_sk_…`) is passed to
  `createDeliveryClient` in a browser context, so keys can't be leaked into a
  bundle; use a publishable key client-side.

  The Studio API Keys page can create publishable keys and set their origins and
  rate limit.

### Patch Changes

- Updated dependencies [5324e33]
- Updated dependencies [8267925]
  - @kon10/client@1.0.0
  - @kon10/auth@1.0.0
  - @kon10/content@1.0.0
  - @kon10/core@1.0.0
  - @kon10/studio-sdk@1.0.0
  - @kon10/ui@1.0.0
