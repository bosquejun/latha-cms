# Kon10 — Project Specification

> A config-driven, modular headless CMS built on TanStack Start.

---

## Overview

Kon10 is an open-source, headless CMS framework built on TanStack Start. It is modular by design — everything is a module, and modules are composed via a single config file. The goal is to be to TanStack Start what Payload CMS is to Next.js: a first-class, deeply integrated CMS experience without leaving the ecosystem.

This is a learning-driven OSS project. Architecture correctness and developer experience come before feature completeness.

> **New here?** The [concept docs](./docs/concepts/) explain the vocabulary
> ([taxonomy](./docs/concepts/taxonomy.md)), the content model
> ([entities](./docs/concepts/entities.md)), and the framework integration
> ([frameworks](./docs/concepts/frameworks.md)).

---

## Repository

- **npm scope:** `@kon10`
- **Domain:** `kon10.dev` or `kon10cms.dev`

---

## Monorepo Structure

```
kon10cms/
├── apps/
│   └── playground/                    # TanStack Start app — dev/test harness
├── packages/
│   ├── core/                          # @kon10/core — types, defineConfig, module registry, hook engine, access evaluator
│   ├── ui/                            # @kon10/ui — design system, primitives, tokens (no CMS knowledge)
│   ├── studio-sdk/                    # @kon10/studio-sdk — CMS-aware Studio layer, field renderers, shell, registry-driven views
│   ├── start/                         # @kon10/start — TanStack Start integration: runtime, RPC dispatcher, client, mountable Studio UI
│   └── modules/                       # all first-party modules live here
│       ├── content/                   # @kon10/content — ContentModule, Collection, Document, Taxonomy
│       ├── auth/                      # @kon10/auth — AuthModule, session handling
│       ├── users/                     # @kon10/users — UsersModule, roles, permissions
│       ├── media/                     # @kon10/media — MediaModule, storage adapters
│       └── storage/                   # @kon10/storage — Drizzle DBAdapter implementation (Turso default)
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── SPEC.md                            # this file
```

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | TanStack Start | Vinxi/Nitro under the hood |
| Routing | TanStack Router | File-based, fully type-safe |
| Server API | TanStack Start `createServerFn` | Replaces REST handlers |
| Data fetching | TanStack Query | Studio UI data layer |
| Forms | TanStack Form | Studio form engine |
| Validation | Zod | Single source of truth — fields → API validation + form validation + TS types |
| ORM | Drizzle | Schema-first, adapter-friendly |
| Default DB | Turso (SQLite) | Serverless, free tier, edge-ready |
| Styling | Tailwind CSS + shadcn/ui | Design system lives in `@kon10/ui` |
| Monorepo | pnpm workspaces + Turborepo | Standard OSS setup |
| Deploy | Vercel (`preset: 'vercel'` in app.config.ts) | Serverless functions per route |

---

## Core Principles

1. **Config is the source of truth.** Everything — routes, DB schema, Studio UI, validation, TypeScript types — derives from `cms.config.ts`.
2. **Zod is the bridge.** Field definitions compile to Zod schemas. Zod schemas drive API validation, TanStack Form validation, and TS type inference simultaneously.
3. **Modules, not collections.** The top-level mental model is modules. Collections live inside ContentModule.
4. **Headless by default.** The Studio UI is one consumer of the same server functions that power the public API. No special treatment.
5. **Adapter-based.** DB, storage, and auth are all swappable via adapter interfaces. Nothing in the kernel is tied to a specific vendor.
6. **TanStack-native.** Server functions, routing, forms, and queries all use TanStack primitives. No Express, no custom server.

---

## The Config File

```ts
// cms.config.ts
import { defineConfig } from '@kon10/core'
import { AuthModule } from '@kon10/auth'
import { UsersModule } from '@kon10/users'
import { ContentModule, Collection, Document, Taxonomy } from '@kon10/content'
import { MediaModule } from '@kon10/media'
import { tursoAdapter } from '@kon10/storage'

export default defineConfig({
  db: tursoAdapter({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  }),

  modules: [
    AuthModule({
      secret: process.env.AUTH_SECRET!,
    }),

    UsersModule({
      roles: ['admin', 'editor', 'viewer'],
      fields: [
        { name: 'bio', type: 'text' },
        { name: 'avatar', type: 'media' },
      ],
    }),

    ContentModule({
      entities: [
        // Singleton — no list view, one record only
        Document({
          slug: 'site-settings',
          fields: [
            { name: 'site_name', type: 'text', required: true },
            { name: 'logo', type: 'media' },
            { name: 'tagline', type: 'text' },
          ],
        }),

        // Many records — standard CRUD list
        Collection({
          slug: 'pages',
          studio: { useAsTitle: 'title' },
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'slug', type: 'text', unique: true, required: true },
            { name: 'content', type: 'richtext' },
            { name: 'seo', type: 'group', fields: [
              { name: 'meta_title', type: 'text' },
              { name: 'meta_description', type: 'text' },
            ]},
          ],
        }),

        Collection({
          slug: 'posts',
          studio: { useAsTitle: 'title' },
          access: {
            read: () => true,
            create: ({ user }) => !!user,
            update: ({ user, doc }) => user?.role === 'admin' || user?.id === doc.authorId,
            delete: ({ user }) => user?.role === 'admin',
          },
          hooks: {
            beforeCreate: [slugifyTitle],
            afterCreate: [sendPublishNotification],
          },
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'slug', type: 'text', unique: true },
            { name: 'content', type: 'richtext' },
            { name: 'status', type: 'select', options: ['draft', 'published'], studio: { sidebar: true } },
            { name: 'author', type: 'relationship', to: 'users', studio: { sidebar: true } },
            { name: 'category', type: 'taxonomy', to: 'categories', studio: { sidebar: true } },
          ],
        }),

        Taxonomy({
          slug: 'categories',
          hierarchical: true,
        }),
      ],
    }),

    MediaModule({
      storage: {
        adapter: 'r2',
        bucket: process.env.R2_BUCKET!,
        accountId: process.env.CF_ACCOUNT_ID!,
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    }),
  ],
})
```

---

## Core Abstractions (`@kon10/core`)

### Primitives

```ts
type Operation = 'create' | 'read' | 'update' | 'delete'

type AccessFn = (ctx: AccessContext) => boolean | Promise<boolean>

type HookFn<T> = (args: HookArgs<T>) => T | Promise<T>
```

### Field Types

```ts
type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'richtext'
  | 'media'
  | 'relationship'
  | 'taxonomy'
  | 'group'      // nested object — recursive
  | 'array'      // repeatable group — recursive
```

### Zod Schema Builder

Field definitions compile to Zod schemas at init time:

```ts
// packages/core/src/schema/builder.ts
export function buildZodSchema(fields: Field[]): z.ZodObject<any>
```

This schema is used for:
- API validation via `.validator()` on server functions
- TanStack Form validation via `zodValidator()` adapter
- TypeScript type inference via `z.infer<typeof schema>`

### Module Interface

```ts
interface Module {
  name: string
  dependsOn?: string[]
  onInit?: (cms: Kon10Instance) => void | Promise<void>
  onReady?: (cms: Kon10Instance) => void | Promise<void>
  routes?: ModuleRoutes
  entities?: EntityDefinition[]
  capabilities?: string[]
  studioPages?: StudioPage[]
}
```

### Adapter Interfaces

```ts
interface DBAdapter {
  find(collection: string, query: Query): Promise<Doc[]>
  findOne(collection: string, id: string): Promise<Doc | null>
  create(collection: string, data: unknown): Promise<Doc>
  update(collection: string, id: string, data: unknown): Promise<Doc>
  delete(collection: string, id: string): Promise<void>
  migrate(collections: Collection[]): Promise<void>
}

interface StorageAdapter {
  upload(file: File): Promise<{ url: string; key: string }>
  delete(key: string): Promise<void>
}

interface AuthAdapter {
  getUser(request: Request): Promise<User | null>
}
```

### Plugin Interface

```ts
interface Plugin {
  name: string
  extendCollections?: (cols: Collection[]) => Collection[]
  extendConfig?: (config: Kon10Config) => Kon10Config
  routes?: Record<string, RouteHandler>
  onInit?: (cms: Kon10Instance) => void | Promise<void>
}
```

---

## Package Responsibilities

| Package | npm name | Responsibility |
|---|---|---|
| `packages/core` | `@kon10/core` | `defineConfig()`, types, module registry, hook engine, access evaluator, Zod schema builder |
| `packages/ui` | `@kon10/ui` | Design system — buttons, inputs, tables, modals, typography, tokens. No CMS knowledge. Usable standalone. |
| `packages/studio-sdk` | `@kon10/studio-sdk` | CMS-aware Studio layer — field renderers, shell layout, sidebar (registry-driven), collection list/form views. Builds on `@kon10/ui`. |
| `packages/start` | `@kon10/start` | TanStack Start integration — runtime, RPC dispatcher + server route, typed client, provider, mountable Studio UI. The framework-integration layer. See [docs/concepts/frameworks](./docs/concepts/frameworks.md). |
| `packages/modules/content` | `@kon10/content` | `ContentModule`, `Collection()`, `Document()`, `Taxonomy()` |
| `packages/modules/auth` | `@kon10/auth` | `AuthModule`, session handling, login/logout |
| `packages/modules/users` | `@kon10/users` | `UsersModule`, roles, permissions |
| `packages/modules/media` | `@kon10/media` | `MediaModule`, file upload, R2/S3 adapters |
| `packages/modules/storage` | `@kon10/storage` | Drizzle `DBAdapter` — Turso (default), Postgres, MySQL |

---

## ContentModule Entities

| Entity | Description | Studio view |
|---|---|---|
| `Collection` | Many records, standard CRUD | List + create + edit |
| `Document` | Single instance, no list | Edit form only (singleton) |
| `Taxonomy` | Hierarchical or flat grouping | Tree manager |

**Rule:** Use `Document` only for structural config (site settings, nav, theme). Use `Collection` for anything an editor manages as a list — including pages, even if there are only 2-3 of them.

---

## Module Resolution Order

```
CoreModule (always first)
  → AuthModule
    → UsersModule
      → ContentModule
        → MediaModule
          → [CustomModules]
            → CMS Ready ✓
```

Modules declare `dependsOn: ['auth', 'users']` and the kernel topologically sorts them at init.

---

## Studio UI Routes (TanStack Router)

```
/studio/                                  → dashboard
/studio/content/$collectionSlug/          → collection list
/studio/content/$collectionSlug/new       → create form
/studio/content/$collectionSlug/$id       → edit form
/studio/documents/$documentSlug/          → singleton edit form
/studio/taxonomy/$taxonomySlug/           → taxonomy manager
/studio/media/                            → media library
/studio/users/                            → user list
/studio/users/$id                         → user edit
/studio/settings/                         → CMS settings
```

Four route templates cover everything: **list**, **create**, **edit**, **singleton**. The `$collectionSlug` / `$documentSlug` params resolve config from the module registry at load time.

---

## Field Studio Config

Fields can declare sidebar placement:

```ts
{ name: 'status', type: 'select', options: ['draft', 'published'], studio: { sidebar: true } }
```

Studio form layout:
- **Main area (2/3 width):** content fields (title, content, slug, groups)
- **Sidebar (1/3 width):** meta fields (status, author, publish date, taxonomy, SEO)

---

## Vercel Deployment

```ts
// apps/playground/app.config.ts
import { defineConfig } from '@tanstack/start/config'

export default defineConfig({
  server: {
    preset: 'vercel',
  },
})
```

Serverless constraints to respect:
- No disk writes → all media goes to R2
- No persistent connections → use Turso (HTTP-based SQLite)
- 60s function timeout on Pro (sufficient for CMS ops)
- Each server function becomes a separate serverless function

---

## Build Phases

Build in phases — do not skip ahead. Each phase must be working end-to-end before moving to the next.

### Phase 1 — Foundation
- [ ] Monorepo scaffold (pnpm + Turborepo)
- [ ] `@kon10/core` — types, `defineConfig()`, Zod schema builder, module registry skeleton
- [ ] `@kon10/storage` — `DBAdapter` implementation for Drizzle + Turso
- [ ] `apps/playground` — TanStack Start app consuming `@kon10/core`
- [ ] One hardcoded `posts` Collection wired end-to-end (server fn → DB → response)

### Phase 2 — Config-Driven API
- [ ] Module registry + resolution order
- [ ] `@kon10/content` — `ContentModule`, `Collection`, `Document`, `Taxonomy`
- [ ] Config → Drizzle schema generation (`migrate()`)
- [ ] Config → server functions (list, findOne, create, update, delete per collection)
- [ ] Access control evaluator
- [ ] Hook engine (before/after lifecycle)

### Phase 3 — Studio UI Shell
- [ ] `@kon10/ui` package setup (Tailwind + shadcn/ui base, design tokens, primitives)
- [ ] `@kon10/studio-sdk` package setup — depends on `@kon10/ui` and `@kon10/core`
- [ ] Studio shell layout (sidebar + topbar) in `studio-sdk`
- [ ] Sidebar derived from module registry
- [ ] TanStack Router Studio routes
- [ ] Field renderer registry
- [ ] Auto-generated collection list view (table)
- [ ] Auto-generated collection form (TanStack Form + Zod)
- [ ] Singleton document form

### Phase 4 — Auth + Users
- [ ] `@kon10/auth` — session-based auth, login/logout
- [ ] `@kon10/users` — user management, role system
- [ ] Auth middleware on Studio routes and server functions

### Phase 5 — Media
- [ ] `@kon10/media` — MediaModule
- [ ] R2 storage adapter
- [ ] Media library UI
- [ ] Media field renderer

### Phase 6 — Polish + Deploy
- [ ] Vercel deployment config
- [ ] Turso production setup
- [ ] Plugin system
- [ ] Public API docs
- [ ] README + contributing guide

---

## Naming Conventions

| Concept | Name | Example |
|---|---|---|
| Top-level grouping | `Module` | `ContentModule`, `AuthModule` |
| Many records | `Collection` | posts, pages, products |
| Single instance | `Document` | site-settings, nav |
| Grouping/tagging | `Taxonomy` | categories, tags |
| Data shape unit | `Field` | text, richtext, select |
| Lifecycle callback | `Hook` | beforeCreate, afterUpdate |
| Permission function | `Access` | read, create, update, delete |
| Cross-cutting concern | `Plugin` | seo, i18n, draft-preview |

---

## Key Files to Create First

```
packages/core/src/
├── index.ts
├── types/
│   ├── config.ts       ← Kon10Config, Module, Plugin
│   ├── field.ts        ← Field union type, all field variants
│   ├── access.ts       ← AccessFn, AccessContext, Operation
│   ├── hook.ts         ← HookFn, HookArgs, CollectionHooks
│   ├── adapter.ts      ← DBAdapter, StorageAdapter, AuthAdapter
│   └── collection.ts   ← Collection, Document, Taxonomy
├── schema/
│   └── builder.ts      ← buildZodSchema(fields: Field[]) → ZodObject
├── registry/
│   └── index.ts        ← ModuleRegistry, resolve order
└── bootstrap/
    └── index.ts        ← defineConfig(), Kon10Instance

packages/ui/src/
├── index.ts
├── tokens/
│   ├── colors.ts       ← color palette, semantic tokens
│   └── typography.ts   ← type scale, font definitions
└── components/
    ├── Button.tsx
    ├── Input.tsx
    ├── Select.tsx
    ├── Table.tsx
    ├── Modal.tsx
    ├── Badge.tsx
    └── ...             ← pure, CMS-unaware primitives

packages/studio-sdk/src/
├── index.ts
├── shell/
│   ├── StudioShell.tsx ← depends on @kon10/ui + @kon10/core registry
│   ├── Sidebar.tsx     ← derived from module registry
│   └── Topbar.tsx
├── views/
│   ├── CollectionList.tsx
│   ├── CollectionForm.tsx
│   ├── DocumentForm.tsx
│   └── TaxonomyManager.tsx
└── fields/
    ├── registry.tsx
    └── renderers/
        ├── TextField.tsx
        ├── RichTextField.tsx
        ├── SelectField.tsx
        ├── MediaField.tsx
        ├── RelationshipField.tsx
        ├── GroupField.tsx
        └── ArrayField.tsx

packages/modules/storage/src/
├── index.ts
├── adapters/
│   ├── turso.ts        ← tursoAdapter() — default
│   ├── postgres.ts     ← postgresAdapter()
│   └── mysql.ts        ← mysqlAdapter()
└── schema/
    └── generator.ts    ← Collection[] → Drizzle schema
```

---

## Notes for Claude Code

- Always start from `SPEC.md` for context.
- Phase 1 first — no Studio UI until the kernel works end-to-end.
- The entry point is `defineConfig()` from `@kon10/core` — not `defineCMS`.
- Zod is the single validation layer. Do not add separate validation logic anywhere.
- All DB access goes through `DBAdapter` from `@kon10/storage` — never call Drizzle directly from app code.
- The Studio surface is one **RPC** layer — a single action-dispatched endpoint, not a REST API. In `@kon10/start` it is served by a framework-owned **server route** (`/__kon10/rpc`); apps can also route it through their own `createServerFn`. See [docs/concepts/taxonomy → RPC vs API](./docs/concepts/taxonomy.md#rpc-vs-api) and [frameworks](./docs/concepts/frameworks.md). Keep the dispatcher in `packages/` so it stays reusable.
- All modules live under `packages/modules/*` — never at the root of `packages/`.
- Studio UI is split into two packages: `@kon10/ui` (dumb design system, no CMS knowledge) and `@kon10/studio-sdk` (CMS-aware, builds on top of `@kon10/ui`). Never put CMS logic in `@kon10/ui`.
- Keep `apps/playground` thin — it should only wire together packages, not contain business logic.
- Prefer explicit types over inference where it aids readability in core packages.
- When in doubt, refer to how Payload CMS v3 solves the same problem — then do it the TanStack way.
