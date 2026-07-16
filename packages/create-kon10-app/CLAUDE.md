# create-kon10-app — Project Scaffolder

The `create-kon10-app` binary (`bin` → `dist/index.js`). Scaffolds a fresh Kon10 app — a config-driven headless CMS on TanStack Start. This is the first thing a new user runs.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **Entry** — `index.ts`: CLI prompt / arg handling.
- **Scaffold** — `scaffold.ts`: writes the template app (config, routes, `package.json`, deps) to the target directory.

## Conventions specific to create-kon10-app

- The scaffolded template is effectively **API surface**: whatever it generates must build and typecheck against the shipped `@kon10/*` packages. CI's `scaffold-smoke` job scaffolds an app, overrides `@kon10/*` to the workspace packages, then installs/builds/typechecks it — that job is what really validates this template. Keep it green.
- When a public package's API changes in a way the template uses (`@kon10/start`, `@kon10/content`, `@kon10/auth`, etc.), update the scaffold template in lockstep or `scaffold-smoke` breaks.
- Not published as `@kon10/*` — it's the standalone `create-kon10-app` package (unscoped).

## Tests

`scaffold.test.ts` via `node:test` against `dist/`, plus the `scaffold-smoke` CI job for end-to-end validation.
