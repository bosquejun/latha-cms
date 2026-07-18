# Kon10 — Developer Philosophy & Design Rules

This file is the authoritative guide for anyone (human or AI) contributing to this codebase. Read it before touching any package.

**What Kon10 is:** a config-driven, modular headless CMS built on TanStack Start. A single `kon10.config.ts` declares the database adapter, the modules, and the plugins; the kernel resolves them, reconciles the schema, and serves both a Studio admin UI and a public delivery API.

---

## Quick Orientation

This is a pnpm + Turborepo monorepo. Workspaces are globbed from `apps/*`, `packages/*`, `packages/clients/*`, `packages/modules/*`, and `packages/plugins/*` (`pnpm-workspace.yaml`).

| Path | Package | What it is |
|---|---|---|
| `packages/core` | `@kon10/core` | The kernel — registry, hook engine, access evaluator, field type registry, `defineConfig`/`bootstrapKon10`, logger + tracing contracts |
| `packages/start` | `@kon10/start` | TanStack Start integration — runtime, RPC dispatcher, client, delivery REST API, Studio mount |
| `packages/studio-sdk` | `@kon10/studio-sdk` | CMS-aware Studio shell, field renderers, auto-generated views |
| `packages/ui` | `@kon10/ui` | Pure design system — shadcn/ui primitives and tokens, zero CMS knowledge |
| `packages/modules/content` | `@kon10/content` | `ContentModule` — `Collection`/`Document`/`Taxonomy` factories, taxonomy ops, `taxonomy` field type |
| `packages/modules/auth` | `@kon10/auth` | Session auth, password hashing, RBAC guards, publishable API keys |
| `packages/modules/users` | `@kon10/users` | The `users` collection, roles, user operations |
| `packages/modules/media` | `@kon10/media` | `MediaModule`, storage adapters, `media` field type |
| `packages/modules/storage` | `@kon10/storage` | `DBAdapter` implementations — Turso/libsql and Postgres/Supabase |
| `packages/modules/cache` | `@kon10/cache` | `CacheAdapter` implementations — `inMemoryCache`, `redisCache` |
| `packages/plugins/slug` | `@kon10/slug` | Template-based slug field with uniqueness + nesting and Studio UX |
| `packages/plugins/seo` | `@kon10/seo` | Injectable SEO metadata field with backend derivation + Studio preview |
| `packages/plugins/sentry` | `@kon10/sentry` | Wires the kernel tracer + error-reporter contracts to Sentry (server via OpenTelemetry, browser via `@sentry/react`) and uploads source maps (`./vite`) |
| `packages/clients/client` | `@kon10/client` | Framework-agnostic headless delivery SDK over the public content API |
| `packages/clients/client-react` | `@kon10/client-react` | React hooks over `@kon10/client` |
| `packages/cli` | `@kon10/cli` | `kon10 typegen` — generate typed content schemas from a Studio's delivery manifest |
| `packages/registry` | `@kon10/registry` | Builds distributable shadcn registry-item JSON for content-site templates |
| `packages/create-kon10-app` | `create-kon10-app` | Project scaffolder |
| `apps/playground` | `@kon10/playground` | Dev/test harness app — the app the `verify` and `run` skills drive |

**Dependency direction is always inward toward `@kon10/core`, never across modules.** See "Separation of Concerns" below — it is the load-bearing rule.

Product-facing documentation lives in `docs/` (concepts, deployment, Studio extensions, recipes); `SPEC.md` is the broad project spec; `rfcs/` and `.changeset/*.md` hold design plans and pending release notes. `CONTRIBUTING.md` covers the human contributor workflow.

---

## Development Workflows

Requirements: Node >= 20 and pnpm (exact version pinned in `package.json`'s `packageManager` field; Corepack picks it up). All top-level scripts run through Turborepo.

```bash
pnpm install        # install workspace deps
pnpm build          # build every package (turbo run build)
pnpm dev            # run the playground at http://localhost:3000
pnpm typecheck      # typecheck every package
pnpm lint           # lint every package (flat ESLint config, eslint.config.mjs)
pnpm test           # run all tests
pnpm test:coverage  # tests with coverage
```

Per-package: `pnpm --filter @kon10/core build`, `pnpm --filter @kon10/content test`, etc.

**Build ordering matters.** `typecheck`, `test`, and `test:coverage` all `dependsOn: ["^build"]` in `turbo.json` — a package is typechecked/tested against its dependencies' *compiled `dist/`*, not their source. After changing `@kon10/core` types, rebuild core before typechecking or testing dependents:

```bash
pnpm --filter @kon10/core build && pnpm -r typecheck
```

### Testing conventions

- Tests use the Node built-in test runner (`node:test`) and **run against compiled output**. A package's `test` script is typically `tsc -p tsconfig.json && node --test $(find dist -name '*.test.js' -print)`. Test files are colocated as `*.test.ts` next to the code they cover.
- Browser E2E lives in `apps/playground/e2e` and drives the real Studio UI (login, CRUD, media upload, extensions) with Playwright: `pnpm --filter @kon10/playground test:e2e`. Chromium is pre-provisioned in this environment — do **not** run `playwright install`.
- To verify a change end-to-end in the real Studio, use the `verify` / `run` skills (they build and drive the playground).

### CI (`.github/workflows/ci.yml`)

Three jobs run on every PR:
1. **checks** — `build` → `typecheck` → `lint` → `test` → `test:coverage`.
2. **e2e** — builds, provisions Chromium, runs the playground Playwright smoke suite.
3. **scaffold-smoke** — scaffolds a fresh app with `create-kon10-app`, overrides `@kon10/*` to the workspace packages, then installs/builds/typechecks it. This is what effectively typechecks the shipped template.

CI should be green before review. `release.yml` handles publishing via Changesets.

### Changesets

Add a changeset describing any user-facing package change: `pnpm changeset` (pick affected packages + a semver bump). Docs-only or CI-only changes don't need one.

---

## The Two Non-Negotiables

### 1. Separation of Concerns Is Absolute

Every package has a strict boundary. Nothing crosses it. This is not a soft guideline — it is the load-bearing wall of the architecture.

| Package | What it owns | What it must never contain |
|---|---|---|
| `@kon10/core` | Kernel primitives: registry, hook engine, access evaluator, module + plugin lifecycle, field type registry contract, logger + tracer contracts | Module-specific logic, Studio/UI concerns, field types owned by modules |
| `@kon10/content` | `ContentModule`, `Collection`/`Document`/`Taxonomy` factories, taxonomy operations, content-specific field types (`taxonomy`) | Auth logic, user logic, media logic |
| `@kon10/auth` | Session handling, RBAC, guards, publishable API keys | User entity logic, content entity logic |
| `@kon10/users` | The `users` collection, user operations | Auth session logic |
| `@kon10/media` | `MediaModule`, storage adapters, media-specific field type (`media`) | Content-specific logic |
| `@kon10/cache` | `CacheAdapter` implementations (`inMemoryCache`, `redisCache`) | Business logic — a cache adapter never knows what's being cached |
| `@kon10/studio-sdk` | Studio UI shell, field renderers, views, display hints | Business logic, persistence logic |
| `@kon10/ui` | Pure design system primitives | Any CMS knowledge whatsoever |
| `@kon10/start` | TanStack Start integration, RPC dispatcher, delivery REST API | Business logic |
| `@kon10/storage` | `DBAdapter` implementations (Turso/libsql, Postgres) — `migrate()` reconciles additively: `CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE ADD COLUMN` for new fields; renames/retypes/removals are never applied and drift is only warned about (`docs/concepts/migrations.md`) | Application logic |
| `@kon10/client` / `@kon10/client-react` | Read-only delivery SDK over the public content API; React bindings | Any server/kernel internals — it talks HTTP only |

**The test:** If you find yourself importing `@kon10/content` from `@kon10/core`, or `@kon10/auth` from `@kon10/content`, stop. The dependency direction is always inward toward core, never across modules.

### 2. Zod Is the Single Source of Truth

Zod schemas come first. TypeScript types are always derived from Zod via `z.infer<>`. Never write a TypeScript interface and then a matching Zod schema — that is duplication and it will diverge.

```ts
// WRONG — TS interface first, Zod schema mirrors it
interface TextField { type: 'text'; name: string; minLength?: number }
const textSchema = z.object({ type: z.literal('text'), name: z.string(), minLength: z.number().optional() })

// RIGHT — Zod schema first, type is inferred
const textFieldSchema = z.object({
  type: z.literal('text'),
  name: z.string(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
})
type TextField = z.infer<typeof textFieldSchema>
```

This applies everywhere: field configs, entity shapes, RPC inputs, API responses. If you are writing a TypeScript interface that mirrors something that could be validated, define the Zod schema first. `@kon10/core` re-exports `z` so consumers use the same Zod version.

---

## The Kernel (`@kon10/core`)

The kernel is a pure, domain-agnostic orchestration layer. It:
- Manages the module + plugin lifecycle (topological resolution, `onInit`, `onReady`) via `bootstrapKon10`
- Runs the hook engine (before/after lifecycle transformers)
- Evaluates access predicates
- Builds document validation schemas from registered field types
- Holds the field type registry contract
- Defines the structured **logger** contract and the **tracer** contract (both provider-agnostic — see below)

The kernel does **not** know about:
- Any specific field types (taxonomy, media, relationship-to-users — these are module concerns)
- Any Studio UI layout or display concepts
- Any specific entity kinds (Collection, Document, Taxonomy — these are `@kon10/content` concerns)
- Any concrete module (auth, users, content, media) or observability vendor (Sentry, pino)

### Entities are structural

Core's only entity vocabulary is **structural**: every `Entity` has a `cardinality` (`'many'` — standard CRUD list — or `'single'` — one record, no list view) and an optional `hierarchical` flag (a self-referential parent field, for `'many'` entities that support nesting). That's the entirety of what the registry, operations layer, and storage migration need to handle every entity uniformly — they never branch on what a module *calls* the entity, only on its cardinality.

`Entity` also carries one opaque passthrough field, `kind?: string`, that the kernel never reads or branches on — the same contract as a field's `meta` bag. Modules stamp it for their own Studio/routing layer to read (e.g. `@kon10/content`'s `Collection()`/`Document()`/`Taxonomy()` factories stamp `'collection'`/`'document'`/`'taxonomy'`). `@kon10/content` owns `Collection`/`Document`/`Taxonomy` as public vocabulary — they are type aliases over `Entity<TDoc>` narrowed by `cardinality`, not separate interfaces in core. `@kon10/studio-sdk` and `@kon10/start` derive their own local `'collection' | 'document' | 'taxonomy'` display vocabulary from the opaque `kind` tag (falling back to a cardinality-derived guess when a module leaves it unset) — that vocabulary lives in those packages, never imported from core.

### Config + bootstrap

`defineConfig(config)` applies defaults and plugin `extendConfig` transforms, returning a `ResolvedConfig`; `bootstrapKon10` resolves modules/plugins, runs `onInit`/`onReady`, and reconciles the schema. A `Kon10Config` declares `db`, `modules`, and optional `plugins`, `studioPath`, delivery `api` settings, a one-time `seed`, and observability (`logger`, `logRedaction`). The kernel treats `studioPath`, `api`, and `seed` as passthroughs that *runners* (`@kon10/start`) read — the kernel itself never acts on them.

### Logger and tracer contracts

- **Logger** (`packages/core/src/logger`): a pino-shaped `Logger` interface. `consoleLogger()` is the default (level via `KON10_LOG_LEVEL`, default `info`); `redactLogger()` wraps any logger to redact `DEFAULT_REDACT_KEYS` (+ `KON10_LOG_REDACT`); `silentLogger` for tests. `logRedaction` in config is applied to whichever logger ends up on the instance.
- **Tracer** (`packages/core/src/tracing`): a minimal vendor-neutral `Tracer`/`Span` contract with `noopTracer` as the default and a `withSpan()` helper. Modules/plugins register a real tracer via `cms.registerTracer(...)`; `@kon10/sentry` implements it over OpenTelemetry. The kernel never imports a vendor SDK.
- **ErrorReporter** (`packages/core/src/errors`): a minimal vendor-neutral `ErrorReporter` contract (`captureException(error, context)`) with `noopErrorReporter` as the default. Runners report *unexpected* (500-class) failures via `cms.errorReporter` after filtering expected control flow (access denials, validation); `@kon10/sentry` implements it over `Sentry.captureException()`. Same edge-vendor rule as the tracer.

---

## Field Type System

### How it works

Field types are registered, not hardcoded. Core ships a registry and registers its own built-in types (`text`, `number`, `boolean`, `date`, `select`, `richtext`, `relationship`, `group`, `array`). Modules and plugins register their own types in `onInit`.

Each registration provides two things:
1. **`configSchema`** — a Zod schema that describes the field definition object (validated at config parse time)
2. **`buildDataSchema`** — a function from the field config to the Zod schema for the stored value (used by `buildDocumentSchema`)

```ts
// core — built-in type registration (inside core's own init)
registerFieldType({
  configSchema: z.object({
    type: z.literal('text'),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
  }),
  buildDataSchema: (config) => {
    let s = z.string()
    if (config.minLength != null) s = s.min(config.minLength)
    if (config.maxLength != null) s = s.max(config.maxLength)
    return s
  },
})

// @kon10/content — ContentModule.onInit registers 'taxonomy'
registerFieldType({
  configSchema: z.object({
    type: z.literal('taxonomy'),
    to: z.string(),
    many: z.boolean().optional(),
  }),
  buildDataSchema: (config) => config.many ? z.array(z.string()) : z.string(),
})

// @kon10/media — MediaModule.onInit registers 'media'
registerFieldType({
  configSchema: z.object({ type: z.literal('media') }),
  buildDataSchema: () => z.string(),
})
```

Plugins register field types the same way — `@kon10/slug` registers `slug`, `@kon10/seo` registers its metadata field — detecting their targets by field *type*, never by field *name*.

### What the `Field` type is

`Field` is the discriminated union of all registered `configSchema` inferred types. It is built from the registry at runtime — there is no hardcoded union in `types/field.ts`.

For TypeScript purposes (compile-time inference), core exports a base `Field` type covering its built-in types. Modules that add field types extend this via TypeScript module augmentation on `FieldTypeMap`:

```ts
// @kon10/content
declare module '@kon10/core' {
  interface FieldTypeMap {
    taxonomy: z.infer<typeof taxonomyFieldConfigSchema>
  }
}
```

### Field display metadata

Fields carry a `meta` bag (`FieldMeta`) for rendering hints. This lives in core because it is part of the field definition that users write in their config — it is not Studio-specific business logic. The kernel passes it through opaquely; only the Studio layer reads it.

```ts
interface FieldMeta {
  label?: string
  description?: string
  placeholder?: string
  hidden?: boolean
  sidebar?: boolean   // Studio form layout hint
}
```

---

## Extension Patterns

### Modules vs. plugins

Both extend the kernel through `onInit`, but they differ in scope:

- A **Module** owns entities and a slice of the domain (content, auth, users, media, storage, cache). It returns an `entities` array and typically registers field types, guards, and Studio UI for its own domain.
- A **Plugin** (`Plugin` interface: `name`, optional `extendConfig`, `onInit`, `studio`) is a cross-cutting capability that augments entities *other* modules contributed — e.g. `@kon10/slug` adds a slug field to any entity that opts in, `@kon10/seo` injects SEO metadata, `@kon10/sentry` registers a tracer. Plugins run `onInit` after all module `onInit`s (before `migrate`). `extendConfig` lets a plugin rewrite the config before resolution.

### Adding a field type
Register in your module's or plugin's `onInit` via `cms.registerFieldType(...)`. Provide both `configSchema` and `buildDataSchema`. Augment `FieldTypeMap` in your `.d.ts` for TypeScript consumers.

### Adding access guards
Register in `onInit` via `cms.registerGuard(guard)`. Guards run after entity-level access predicates. Used by `@kon10/auth` for RBAC.

### Adding a tracer
Register in `onInit` via `cms.registerTracer(tracer)`. The kernel defaults to `noopTracer`; `@kon10/sentry` provides a real one.

### Adding an error reporter
Register in `onInit` via `cms.registerErrorReporter(reporter)`. The kernel defaults to `noopErrorReporter`; `@kon10/sentry` provides a real one over `Sentry.captureException()`. Report only genuine faults through `cms.errorReporter` — expected control flow (access denials, validation) is filtered out at the runner boundary.

### Adding Studio UI
Follow the Studio extension convention (`src/studio/widgets/`, `src/studio/pages/`, etc.) or use `defineStudioExtensions` explicitly. A module/plugin points at a serializable barrel import specifier via `studio.ui` (e.g. `'@kon10/slug/studio'`) — the Start Vite plugin statically imports and merges it at build time. No module should write directly to `@kon10/studio-sdk` internals. See `docs/studio-extensions.md`.

### Adding entities
Return them in your module's `entities` array. The kernel registry discovers and de-duplicates them.

---

## Naming Rules

- `CollectionHooks`, `CollectionAccess`, `CollectionStudioConfig` → dead names. Use `EntityHooks`, `EntityAccess`, `EntityStudioConfig`.
- Hook args use `slug` (the entity slug), not `collection` — hooks run on documents and singletons too.
- No `Collection` prefix on generic concepts. `Collection` is a content-module entity kind, not a kernel concept.
- Field type discriminants are lowercase strings (`'text'`, `'taxonomy'`). Field config types are PascalCase (`TextField`, `TaxonomyField`).

---

## What "Generic" Means for Core

A concept belongs in core if it would be needed by a hypothetical CMS that has no content module, no auth module, and no Studio UI. The kernel is a lifecycle + validation + access orchestration layer. If a concept only makes sense in the presence of a specific module, it belongs in that module.

Ask: "Would a minimal CMS with only users and no content need this?" If yes → core. If no → the relevant module.

---

## Active Refactor: Zod-First Field Registry

**Status: Complete**

The field type system has been migrated from TypeScript-first (TS interfaces → Zod) to Zod-first (Zod schemas → inferred TS types). `types/field.ts` and the `schema/builder.ts` switch are gone; `packages/core/src/fields/` (`registry.ts`, `builtins.ts`, `meta.ts`, `types.ts`) is the only mechanism — all field types, including core's 9 built-ins, come from registered `configSchema`/`buildDataSchema` pairs, and `taxonomy()`/`media()` are registered by their owning modules' `onInit`.

Do not add new field types outside the registry (`registerFieldType`) — there is no `types/field.ts` or `schema/builder.ts` switch to fall back to.

---

## Commit Discipline

- Commits are scoped: `feat(content):`, `fix(core):`, `refactor(studio-sdk):`, etc.
- Do not mix cross-package concerns in one commit unless they are a single atomic change (e.g., an interface rename that must update all consumers simultaneously).
- After any refactor to core, run `pnpm -r typecheck` before committing.
- After any change to `@kon10/core` types, rebuild core (`pnpm --filter @kon10/core build`) before typechecking dependent packages.
- Add a changeset (`pnpm changeset`) for user-facing package changes.

## Naming Note: RBAC vs. Studio Branding

The seeded `admin` role, `SUPERADMIN`, and related RBAC terminology are generic access-control vocabulary — "the administrator role" — not tied to the Studio product name. Do not rename them when Studio-branded UI concepts change. `STUDIO_ACCESS` / `studio:access` is the permission that gates entry to the Studio UI and does track the product name; the seeded role name does not.
