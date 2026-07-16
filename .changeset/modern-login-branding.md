---
'@kon10/studio-sdk': minor
'@kon10/start': minor
---

feat(studio): modern, brandable login screen and Studio branding

The `/login` screen is redesigned with a cleaner, minimal layout (centered logo
mark, password show/hide, inline error alert) and is now fully brandable
alongside the Studio shell via a new `branding` prop on `<Kon10Provider>`:

- `branding.appName` — wordmark shown in the shell, login subtitle, and footer
- `branding.logo` — a React node used as the brand mark on the login screen and
  in the top nav / mobile menu (falls back to the new `Kon10Logo` `KO` mark)
- `branding.loginTitle` / `branding.loginSubtitle` — login copy

All fields are optional and default to the Kon10 mark and copy, so existing apps
render the new default branding with no changes. `Kon10Logo`, `Kon10Branding`,
and `ResolvedBranding` are exported from `@kon10/start`.
