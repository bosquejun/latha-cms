# Testing strategy

Kon10 is a TypeScript monorepo with framework packages, CMS modules, plugins, and a runnable playground. The quality plan is to keep fast checks close to each package while GitHub Actions runs the whole stack for every pull request.

## Test pyramid

1. **Static quality gates**
   - TypeScript type checks for every package and app.
   - ESLint for packages that expose a lint script.
   - Production builds to validate package exports, declaration output, and bundling.

2. **Unit tests**
   - Cover deterministic logic such as schemas, field helpers, registries, cache adapters, slug formatting, and module configuration.
   - Use Node's built-in test runner so tests execute without a large test framework dependency.
   - Keep these tests fast and isolated from network services.

3. **Integration tests**
   - Exercise package seams: bootstrapping modules, operations against an in-memory DB adapter, RPC/API handlers, server hardening, caching, auth, and plugin hooks.
   - Prefer fake adapters and in-memory implementations unless validating a real external adapter.
   - Add service-backed jobs later for Redis, Postgres, or libSQL when those adapters become release-blocking.

4. **End-to-end tests**
   - Add browser automation around the playground app for high-value flows: Studio login, entity list, entity create/edit, upload, and extension rendering.
   - Keep E2E smoke coverage small in pull requests and expand to scheduled/nightly workflows for broader browser matrices.

5. **Coverage monitoring**
   - Run package tests with Node's `--experimental-test-coverage` flag in CI.
   - Use the generated summaries as a regression signal while the suite grows; enforce thresholds once baseline coverage is stable.

## Current automation

GitHub Actions runs on pushes to `main` and every pull request. The workflow installs with the locked pnpm version, then runs build, typecheck, lint, unit/integration tests, and coverage.

## Near-term priorities

- Add missing unit tests for packages that currently have no test script, starting with `@kon10/users`.
- Add playground E2E smoke tests after selecting a browser runner and stable test data setup.
- Add adapter integration jobs for Redis/Postgres/libSQL behind services or opt-in scheduled workflows.
- Publish coverage artifacts or reports once coverage output is standardized across packages.
