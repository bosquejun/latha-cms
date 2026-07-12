# Kon10

> A config-driven, modular headless CMS built on TanStack Start.

[![CI](https://github.com/bosquejun/kon10/actions/workflows/ci.yml/badge.svg)](https://github.com/bosquejun/kon10/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Kon10 is an open-source headless CMS framework built on TanStack Start.
Everything is a module, and modules are composed via a single config file:
config → Zod schema → API → database → an auto-generated Studio UI.

- **Documentation** — [`docs/`](./docs/) for v1 reference material, including
  [entities](./docs/concepts/entities.md) (content model),
  [taxonomy](./docs/concepts/taxonomy.md) (vocabulary),
  [RBAC](./docs/concepts/rbac.md) (authorization),
  [migrations](./docs/concepts/migrations.md) (schema reconciliation), and
  [deployment](./docs/deployment.md) (production checklist).
- **Architecture** — [`SPEC.md`](./SPEC.md) and [`CLAUDE.md`](./CLAUDE.md).
- **Contributing** — [`CONTRIBUTING.md`](./CONTRIBUTING.md) ·
  security reports via [`SECURITY.md`](./SECURITY.md).

## What's in the box

- **Kernel** (`@kon10/core`) — module registry with topological resolution,
  before/after lifecycle hooks, access predicates + pluggable guards, and a
  Zod-first field registry: one schema drives API validation, form validation,
  and TypeScript inference.
- **Content** (`@kon10/content`) — `Collection()` / `Document()` /
  `Taxonomy()` factories, drafts, blocks, and the content field types.
- **Auth** (`@kon10/auth`) — session auth on pure Web Crypto (PBKDF2 + HMAC,
  no native deps), RBAC with a seeded role catalog, API keys for the delivery
  API, login throttling, and a CSRF origin guard.
- **Users** (`@kon10/users`) — the `users` collection and role assignment.
- **Media** (`@kon10/media`) — uploads with `localDiskStorage` for dev and an
  S3-compatible adapter (AWS S3, Cloudflare R2) for production.
- **Storage** (`@kon10/storage`) — `DBAdapter`s for Turso/libsql (default,
  works as a local SQLite file) and Postgres/Supabase, with additive schema
  reconciliation at boot.
- **Cache** (`@kon10/cache`) — read-through delivery-API caching via
  `inMemoryCache()` or `redisCache`.
- **Studio** (`@kon10/studio-sdk` + `@kon10/ui`) — a fully auto-generated
  admin UI (lists, forms, singletons) with a structured extension system.
- **Delivery API** (`@kon10/start`) — a read-only public REST surface
  (`/api/v1/…`) with a stable response envelope, CORS, pagination, and
  filtering.
- **Observability** — structured, pino-compatible logging with one request
  line per RPC/API call and a `requestId` on every failure envelope
  (`KON10_LOG_LEVEL`, `logger` config key).
- **Tooling** — `create-kon10-app` scaffolder, the slug plugin
  (`@kon10/slug`), and a playground app.

## Packages

| Package | Path | Responsibility |
|---|---|---|
| `@kon10/core` | `packages/core` | Kernel — types, `defineConfig`, registry, hooks, access, field registry, operations, logger |
| `@kon10/ui` | `packages/ui` | Design system — shadcn/ui primitives + tokens. No CMS knowledge. |
| `@kon10/studio-sdk` | `packages/studio-sdk` | CMS-aware Studio layer — shell, field renderers, auto-generated views |
| `@kon10/start` | `packages/start` | TanStack Start integration — runtime, RPC dispatcher, delivery API, typed client, mountable Studio/login UI |
| `@kon10/content` | `packages/modules/content` | `ContentModule`, `Collection`/`Document`/`Taxonomy`, content field types |
| `@kon10/auth` | `packages/modules/auth` | `AuthModule`, sessions, RBAC, API keys, login/logout |
| `@kon10/users` | `packages/modules/users` | `UsersModule`, the `users` collection, roles |
| `@kon10/media` | `packages/modules/media` | `MediaModule`, uploads, local-disk + S3-compatible storage adapters |
| `@kon10/storage` | `packages/modules/storage` | `DBAdapter`s — Turso/libsql and Postgres, additive schema reconciliation |
| `@kon10/cache` | `packages/modules/cache` | `CacheAdapter`s — in-memory and Redis |
| `@kon10/slug` | `packages/plugins/slug` | Slug plugin — generation + uniqueness hooks, `slug()` field |
| `create-kon10-app` | `packages/create-kon10-app` | Project scaffolder |
| `@kon10/playground` | `apps/playground` | TanStack Start dev/test harness |

## Getting started

The fastest path is the scaffolder:

```bash
pnpm create kon10-app my-app     # or: npm create kon10-app my-app
cd my-app
pnpm install
pnpm dev                         # http://localhost:3000
```

On first run it seeds an admin user so you can sign in at `/studio`:

```
email:    admin@kon10.dev   (override with ADMIN_EMAIL)
password: password          (override with ADMIN_PASSWORD)
```

The scaffolder writes a generated `AUTH_SECRET` to `.env`; production
deployments must set it themselves (see [deployment](./docs/deployment.md)).
The database defaults to a local SQLite file (`file:local.db`) — point it at
Turso via `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`.

To hack on the framework itself:

```bash
pnpm install        # install workspace deps
pnpm build          # build every package
pnpm dev            # run the playground at http://localhost:3000
```

## The config

Fields are Zod-first builders: the same definition drives server validation,
Studio form validation, and TypeScript inference.

```ts
import { defineConfig, z } from '@kon10/core'
import { tursoAdapter } from '@kon10/storage'
import {
  Collection, ContentModule, Document, Taxonomy,
  date, richtext, select, text,
} from '@kon10/content'

export const kon10Config = defineConfig({
  db: tursoAdapter({ url: process.env.TURSO_DATABASE_URL ?? 'file:local.db' }),
  modules: [
    ContentModule({
      entities: [
        Document({
          slug: 'site-settings',
          fields: {
            site_name: text({ required: true }),
          },
        }),
        Collection({
          slug: 'posts',
          studio: { useAsTitle: 'title' },
          fields: {
            title: text({ required: true }),
            body: richtext(),
            status: select({ options: z.enum(['draft', 'published']) }),
            publishedAt: date({ meta: { sidebar: true } }),
          },
        }),
        Taxonomy({ slug: 'categories', hierarchical: true }),
      ],
    }),
  ],
})
```

Field definitions compile to a Zod schema that drives API validation, form
validation, and TypeScript inference simultaneously — Zod is the single
validation layer.

## How a consuming app uses Kon10

The config is the single entrypoint. `@kon10/start` provides everything else —
the runtime, the RPC endpoint, the delivery API, auth, and the Studio UI. The
`kon10Start()` Vite plugin injects the framework's `/login`, `/studio/$`,
`/__kon10/rpc`, and `/api/v1/$` routes, so the app ships **no** boilerplate
route or server-function files — `src/routes/` holds only the app's own pages
(this is exactly what `create-kon10-app` scaffolds):

```
your-app/
├── kon10.config.ts            # ★ the entrypoint — defineConfig({ ... })
├── vite.config.ts             # plugins: [..., kon10Start(), viteReact()]
└── src/
    ├── router.tsx             # TanStack Start's getRouter()
    ├── styles.css             # @import '@kon10/ui/styles.css'
    └── routes/
        ├── __root.tsx         # <Kon10Provider>…</Kon10Provider>
        └── index.tsx          # the app's own landing page (anything you like)
```

```ts
// vite.config.ts — kon10Start() wraps tanstackStart() and injects the routes
import { defineConfig } from 'vite'
import { kon10Start } from '@kon10/start/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [kon10Start({ configPath: './kon10.config.ts' }), viteReact()],
})
```

```tsx
// src/routes/__root.tsx — mount the provider around your app
import { Kon10Provider } from '@kon10/start'
import { studioExtensions } from 'virtual:kon10/studio-extensions'

<Kon10Provider basePath="/studio" loginPath="/login" extensions={studioExtensions}>
  <Outlet />
</Kon10Provider>
```

Prefer to keep the routes explicit? Mount them with one-line re-exports
instead — the route definitions still live in the framework
(`@kon10/start/routes/login`, `/routes/studio`, `/routes/rpc`, `/routes/api`).

The Studio (at `/studio/$`) derives the sidebar, list views, and forms from
the config, guards the session, and routes internally — there is no
per-collection app code. The content you model is served read-only at
`/api/v1/<module>/<collection>[/<id>]` with a stable `{ data, error,
pagination? }` envelope.

> **On the package name:** `@kon10/start` mirrors the framework it integrates
> (TanStack Start) and stays short. Adapter-style alternatives like
> `@kon10/react-start` or `@kon10/tanstack-start` were considered; the name was
> kept since Kon10 is defined as "built on TanStack Start."

## Customizing the Studio

The auto-generated Studio is extensible through a structured set of **injection
zones** and **custom pages** — the Kon10 take on Medusa's admin extensions.
Drop files under `src/studio/` and the `kon10Start()` Vite plugin auto-collects
them into `virtual:kon10/studio-extensions`, which you hand to the provider:

```tsx
import { Kon10Provider } from '@kon10/start'
import { studioExtensions } from 'virtual:kon10/studio-extensions'

<Kon10Provider client={kon10} extensions={studioExtensions}>…</Kon10Provider>
```

```tsx
// src/studio/widgets/post-tips.tsx — a widget in the form sidebar
import { defineWidgetConfig, type WidgetContext } from '@kon10/start'

export const config = defineWidgetConfig({ zone: 'form.sidebar.before' })
export default function PostTips({ entity }: WidgetContext) { … }
```

Six surfaces are supported: **widgets** (injected into named zones like
`shell.topbar.start`, `list.after`, `form.sidebar.before`), **custom pages**,
**dashboard widgets**, **settings pages**, **field-renderer overrides**, and
**nav links**. The engine is a plain registry, so you can also pass an
`extensions` object built by hand with `defineStudioExtensions` — no Vite plugin
required.

The sidebar keeps itself tidy: items are **ungrouped** (a flat, label-less list)
by default, modules opt into a **named heading** via `studio.nav` (ContentModule →
"Content"), and a conventional **Settings** area is pinned to the bottom (where
Users and settings pages collect). Full guide:
[`docs/studio-extensions.md`](./docs/studio-extensions.md).

## Logging & traceability

Kon10 logs one structured line per request through a minimal, pino-compatible
logger. The console-backed default needs no setup; any pino-shaped logger
drops in via the config:

```ts
defineConfig({ logger: pino(), … })
```

Control the built-in logger's threshold with `KON10_LOG_LEVEL`
(`debug` | `info` | `warn` | `error` | `silent`). Sensitive keys
(`password`, `secret`, `token`, `apikey`, `authorization`, `cookie`, …) are
**redacted by default** — recursively, case-insensitively, by substring —
for the built-in logger *and* any custom logger you pass. Extend the stems
via `KON10_LOG_REDACT=ssn,internalNote` or `logRedaction: ['ssn']` in the
config; opt out with `logRedaction: false` when your logger redacts itself.
Every failure response from the delivery API carries an `error.requestId`
that matches the server-side log line, so a client-reported error can be
correlated with its logs. Details in [deployment](./docs/deployment.md).

## Roadmap

Shipped in v1: kernel, content (collections/documents/taxonomies, drafts,
blocks), auth (sessions, RBAC, API keys), users, media (local + S3/R2),
storage (Turso/SQLite + Postgres), delivery-API caching (memory/Redis), the
Studio with its extension system, structured logging, and `create-kon10-app`.

Planned next (in no particular order):

- `@kon10/audit` — a change trail (who changed what, when), built on the
  existing `after*` hooks with a Studio settings page.
- `@kon10/webhooks` — first-class webhook delivery; today's userland recipe is
  [documented](./docs/recipes/webhooks.md).
- Migration tooling — diff-based, generated migrations for the
  rename/retype/remove cases the additive reconciler
  [deliberately skips](./docs/concepts/migrations.md).
- Password reset / email flows (admins can reset passwords via the Users UI
  today).
- Content versioning & revisions, and localization (i18n).

## License

[MIT](./LICENSE) © Kon10 contributors
