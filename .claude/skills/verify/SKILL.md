---
name: verify
description: Build, run, and drive the Kon10 playground Studio to verify changes end-to-end.
---

# Verifying Kon10 changes in the playground Studio

## Build

```bash
pnpm install
pnpm -r --sort build          # builds packages in dependency order (ui → studio-sdk → start → playground)
```

## Run

Use the **dev server**, not the production build — the nitro `.output` bundle
externalizes `@libsql/client` and fails at runtime with `ERR_MODULE_NOT_FOUND`
(pnpm keeps it out of `.output/server/node_modules`):

```bash
cd apps/playground && pnpm dev   # vite dev on http://localhost:3000
```

Uses `apps/playground/local.db` (libsql). First run seeds an admin:
`admin@kon10.dev` / `password` (see `kon10.config.base.ts` seed).

## Drive

Playwright with the pre-installed browser (`executablePath: '/opt/pw-browsers/chromium'`,
`npm i playwright-core` in a scratch dir). Login is a real page at `/login`
(two inputs + submit); the auth POST goes to `/__kon10/modules/auth/login`.
Loading `/studio/...` unauthenticated renders a client-side "Redirecting…"
splash — always log in via `/login` first, then `waitForURL('**/studio**')`.

Useful routes: `/studio` (dashboard), `/studio/content/<slug>` (lists),
`/studio/documents/<slug>` (singletons, e.g. `landing-page`, `footer`),
`/studio/settings/content/users` (settings-area entity).

Gotchas:
- Nav links exist twice in the DOM (hidden MobileMenu + visible rail/tabs);
  plain `a[href=...]` selectors hit the hidden one — scope to
  `nav[aria-label]` or use `getByRole('link', { name: ... })`, and the
  section tab can share an href with its first sub-item.
- Layout measurements: `document.querySelector('main').parentElement` is the
  rail + content flex wrapper that `contentWidth` sizes
  (`max-w-content-max` = 1152px at default, viewport width at full).
