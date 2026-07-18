# Contributing to Kon10

Thanks for your interest in contributing! This guide covers the practical
workflow. The architectural rules — which are strict and non-negotiable —
live in [`CLAUDE.md`](./CLAUDE.md); read it before touching any package.

## Development setup

Requirements: Node >= 20 and [pnpm](https://pnpm.io) (the exact version is
pinned in `package.json`'s `packageManager` field — Corepack picks it up
automatically).

```bash
pnpm install        # install workspace deps
pnpm build          # build every package (Turborepo)
pnpm dev            # run the playground at http://localhost:3000
```

Other useful commands:

```bash
pnpm typecheck      # typecheck every package
pnpm lint           # lint every package
pnpm test           # run all tests (node:test, runs against dist)
```

## Monorepo layout

| Path | Package | What it is |
|---|---|---|
| `packages/core` | `kon10` | The kernel — registry, hooks, access, field registry |
| `packages/start` | `@kon10/start` | TanStack Start integration, RPC + delivery API |
| `packages/studio-sdk` | `@kon10/studio-sdk` | Studio UI shell and views |
| `packages/ui` | `@kon10/ui` | Pure design system (no CMS knowledge) |
| `packages/modules/*` | `@kon10/{content,auth,users,media,storage,cache}` | Feature modules |
| `packages/plugins/*` | `@kon10/slug`, … | Plugins |
| `packages/create-kon10-app` | `create-kon10-app` | Project scaffolder |
| `apps/playground` | — | Dev/test harness app |

## The two rules that will get your PR bounced

1. **Separation of concerns is absolute.** Package boundaries are strict;
   dependencies point inward toward `kon10`, never across modules.
   See the table in `CLAUDE.md`.
2. **Zod is the single source of truth.** Define the Zod schema first and
   derive TypeScript types with `z.infer<>`. Never write a TS interface and
   a matching Zod schema by hand.

## Workflow

1. Fork and create a topic branch.
2. Make your change, with tests. Tests use `node:test` and run against
   compiled output (`pnpm --filter <pkg> test`).
3. Keep commits scoped: `feat(content): …`, `fix(core): …`,
   `refactor(studio-sdk): …`. Don't mix cross-package concerns in one
   commit unless they're a single atomic change.
4. After changing `kon10` types, rebuild core before typechecking
   dependents: `pnpm --filter kon10 build && pnpm -r typecheck`.
5. **Add a changeset** describing your change for the release notes:
   `pnpm changeset` (pick the affected packages and a semver bump).
   Docs-only or CI-only changes don't need one.
6. Open a PR. CI runs build, typecheck, lint, and tests — it should be
   green before review.

## Reporting bugs and requesting features

Use the [issue templates](https://github.com/bosquejun/kon10/issues/new/choose).
For security issues, **do not open a public issue** — see
[`SECURITY.md`](./SECURITY.md).

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).
By participating you agree to uphold it.
