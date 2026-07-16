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
  The `/login` screen is redesigned as a modern, minimal split layout (branded ink
  side panel + clean form with password show/hide and an inline error alert).
  `Kon10Logo` and `resolveBrandLogo` are exported.
- `@kon10/studio-sdk` — `<Kon10Provider>` accepts a `branding` prop
  (`Kon10Branding`), threaded through to the login screen and the shell
  (`StudioShell` / top nav / mobile menu gain an optional `logo`). The prop's
  `logo` accepts either an image URL (as from config) or a `ReactNode` override.

Every field is optional and defaults to the Kon10 mark and copy, so existing apps
render the new default branding with no changes. The scaffold template wires
`branding={studioConfig.branding}` out of the box.
