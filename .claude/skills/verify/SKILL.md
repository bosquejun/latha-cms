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
# Seed an admin so you can log straight in, instead of walking /setup:
cd apps/playground && ADMIN_EMAIL=admin@kon10.dev ADMIN_PASSWORD=password pnpm dev
```

Uses `apps/playground/local.db` (libsql). **No admin is seeded unless BOTH
`ADMIN_EMAIL` and `ADMIN_PASSWORD` are set** (see `kon10.config.base.ts` seed) —
without them the install starts empty and `/login` redirects to `/setup` to
create the first admin. Set them as above for verification runs; the E2E suite
does the same in `e2e/server.mjs`.

## Drive

Playwright with the pre-installed browser (`executablePath: '/opt/pw-browsers/chromium'`,
`npm i playwright-core` in a scratch dir). Login is a real page at `/login`
(two inputs + submit); the auth POST goes to `/__kon10/modules/auth/login`.
Loading `/studio/...` unauthenticated renders a client-side "Redirecting…"
splash — always log in via `/login` first, then `waitForURL('**/studio**')`.

To verify first-run setup instead, start with the two `ADMIN_*` vars unset and
a deleted `local.db`; `/login` then redirects to `/setup` (name/email/password
+ submit), which signs the new admin in and lands on `/studio`.

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
