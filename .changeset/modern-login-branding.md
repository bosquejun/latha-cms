---
'@kon10/core': minor
'@kon10/studio-sdk': minor
'@kon10/start': minor
---

feat(studio): config-driven branding + modern login screen

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

The Studio also gains an optional, one-time **telemetry transparency notice**:
set `studio.telemetryNotice.enabled` to disclose (once per user, via
`localStorage`) that your instance sends operational telemetry. It is
informational only — it never gates telemetry — and carried client-side through
the same `virtual:kon10/studio-config` module (`telemetryNotice`).
