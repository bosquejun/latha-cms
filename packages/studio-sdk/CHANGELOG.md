# @kon10/studio-sdk

## 1.2.0

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

## 1.0.3

### Patch Changes

- @kon10/core@1.0.3
- @kon10/ui@1.0.3

## 1.0.2

### Patch Changes

- edeab7e: Make Studio telemetry consent enforcement match the configured notice mode,
  keep per-user browser preferences synchronized, and scaffold the complete
  first-login opt-out and telemetry settings experience.
- Updated dependencies [edeab7e]
  - @kon10/core@1.0.2
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

- Updated dependencies [6e7fe1c]
- Updated dependencies [fe180c5]
- Updated dependencies [5c52497]
- Updated dependencies [424296e]
  - @kon10/core@1.0.1
  - @kon10/ui@1.0.1

## 1.0.0

### Patch Changes

- @kon10/core@1.0.0
- @kon10/ui@1.0.0
