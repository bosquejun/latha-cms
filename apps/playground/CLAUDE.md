# @kon10/playground — Dev / Test Harness App

Not a published package — the reference app the monorepo develops against. `pnpm dev` runs it (http://localhost:3000), and the `verify` / `run` skills build and drive it to check changes end-to-end in the real Studio.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## What's here

- **Config** — thin environment entrypoints (`kon10.config.ts`, `kon10.config.vercel.ts`) compose the project configuration in `src/kon10/`. Domain modules live in `src/kon10/modules/`, reusable field builders and schemas in `src/kon10/fields/`, and cross-cutting plugins, Studio settings, and seed data beside the main composition file. This is the canonical example of how an app composes Kon10.
- **App** — `src/` (`router.tsx`, `routes/`, `styles.css`): the TanStack Start app that mounts the Studio + delivery API via `@kon10/start`.
- **E2E** — `e2e/`: Playwright specs that drive the real Studio UI (login, CRUD, media upload, extensions). Run with `pnpm --filter @kon10/playground test:e2e`.

## Conventions specific to playground

- The dev server serves `@kon10/*` **from source**, so changes show up without a rebuild — but CI still builds first to catch build breaks and keep parity with the documented verify flow.
- Treat the config as living documentation: when a module/plugin's public API changes, update the playground config so it stays a working example.
- Chromium is pre-provisioned in this environment — **do not** run `playwright install`.
- This app is the target of the `verify` and `run` skills; prefer them over ad-hoc server wrangling to confirm a change works.

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `test:e2e`.
