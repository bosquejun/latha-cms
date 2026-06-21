# LathaCMS — Project Specification

> A config-driven, modular headless CMS built on TanStack Start. 🇵🇭
> *Latha* comes from the Filipino word *lathala* — to publish.

---

## Overview

LathaCMS is an open-source, headless CMS framework built on TanStack Start. It is modular by design — everything is a module, and modules are composed via a single config file. The goal is to be to TanStack Start what Payload CMS is to Next.js: a first-class, deeply integrated CMS experience without leaving the ecosystem.

This is a learning-driven OSS project. Architecture correctness and developer experience come before feature completeness.

---

## Repository

- **npm scope:** `@latha`
- **Domain:** `latha.dev` or `lathacms.dev`

---

## Monorepo Structure

```
lathacms/
├── apps/
│   └── playground/                    # TanStack Start app — dev/test harness
├── packages/
│   ├── core/                          # @latha/core — types, defineConfig, module registry, hook engine, access evaluator
│   ├── ui/                            # @latha/ui — design system, primitives, tokens (no CMS knowledge)
│   ├── admin-sdk/                     # @latha/admin-sdk — CMS-aware admin layer, field renderers, shell, registry-driven views
│   └── modules/                       # all first-party modules live here
│       ├── content/                   # @latha/content — ContentModule, Collection, Document, Taxonomy
│       ├── auth/                      # @latha/auth — AuthModule, session handling
│       ├── users/                     # @latha/users — UsersModule, roles, permissions
│       ├── media/                     # @latha/media — MediaModule, storage adapters
│       └── storage/                   # @latha/storage — Drizzle DBAdapter implementation (Turso default)
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
| Data fetching | TanStack Query | Admin UI data layer |
| Forms | TanStack Form | Admin form engine |
| Validation | Zod | Single source of truth — fields → API validation + form validation + TS types |
| ORM | Drizzle | Schema-first, adapter-friendly |
| Default DB | Turso (SQLite) | Serverless, free tier, edge-ready |
| Styling | Tailwind CSS + shadcn/ui | Design system lives in `@latha/ui` |
| Monorepo | pnpm workspaces + Turborepo | Standard OSS setup |
| Deploy | Vercel (`preset: 'vercel'` in app.config.ts) | Serverless functions per route |

---

## Core Principles

1. **Config is the source of truth.** Everything — routes, DB schema, admin UI, validation, TypeScript types — derives from `cms.config.ts`.
2. **Zod is the bridge.** Field definitions compile to Zod schemas. Zod schemas drive API validation, TanStack Form validation, and TS type inference simultaneously.
3. **Modules, not collections.** The top-level mental model is modules. Collections live inside ContentModule.
4. **Headless by default.** The admin UI is one consumer of the same server functions that power the public API. No special treatment.
5. **Adapter-based.** DB, storage, and auth are all swappable via adapter interfaces. Nothing in the kernel is tied to a specific vendor.
6. **TanStack-native.** Server functions, routing, forms, and queries all use TanStack primitives. No Express, no custom server.

---

## The Config File

```ts
// cms.config.ts
import { defineConfig } from '@latha/core'
import { AuthModule } from '@latha/auth'
import { UsersModule } from '@latha/users'
import { ContentModule, Collection, Document, Taxonomy } from '@latha/content'
import { MediaModule } from '@latha/media'
import { tursoAdapter } from '@latha/storage'

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
          admin: { useAsTitle: 'title' },
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
          admin: { useAsTitle: 'title' },
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
            { name: 'status', type: 'select', options: ['draft', 'published'], admin: { sidebar: true } },
            { name: 'author', type: 'relationship', to: 'users', admin: { sidebar: true } },
            { name: 'category', type: 'taxonomy', to: 'categories', admin: { sidebar: true } },
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

## Core Abstractions (`@latha/core`)

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
interface CMSModule {
  name: string
  dependsOn?: string[]
  onInit?: (cms: CMSInstance) => void | Promise<void>
  onReady?: (cms: CMSInstance) => void | Promise<void>
  routes?: ModuleRoutes
  entities?: EntityDefinition[]
  capabilities?: string[]
  adminPages?: AdminPage[]
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
interface CMSPlugin {
  name: string
  extendCollections?: (cols: Collection[]) => Collection[]
  extendConfig?: (config: LathaConfig) => LathaConfig
  routes?: Record<string, RouteHandler>
  onInit?: (cms: CMSInstance) => void | Promise<void>
}
```

---

## Package Responsibilities

| Package | npm name | Responsibility |
|---|---|---|
| `packages/core` | `@latha/core` | `defineConfig()`, types, module registry, hook engine, access evaluator, Zod schema builder |
| `packages/ui` | `@latha/ui` | Design system — buttons, inputs, tables, modals, typography, tokens. No CMS knowledge. Usable standalone. |
| `packages/admin-sdk` | `@latha/admin-sdk` | CMS-aware admin layer — field renderers, shell layout, sidebar (registry-driven), collection list/form views. Builds on `@latha/ui`. |
| `packages/modules/content` | `@latha/content` | `ContentModule`, `Collection()`, `Document()`, `Taxonomy()` |
| `packages/modules/auth` | `@latha/auth` | `AuthModule`, session handling, login/logout |
| `packages/modules/users` | `@latha/users` | `UsersModule`, roles, permissions |
| `packages/modules/media` | `@latha/media` | `MediaModule`, file upload, R2/S3 adapters |
| `packages/modules/storage` | `@latha/storage` | Drizzle `DBAdapter` — Turso (default), Postgres, MySQL |

---

## ContentModule Entities

| Entity | Description | Admin view |
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

## Admin UI Routes (TanStack Router)

```
/admin/                                  → dashboard
/admin/content/$collectionSlug/          → collection list
/admin/content/$collectionSlug/new       → create form
/admin/content/$collectionSlug/$id       → edit form
/admin/documents/$documentSlug/          → singleton edit form
/admin/taxonomy/$taxonomySlug/           → taxonomy manager
/admin/media/                            → media library
/admin/users/                            → user list
/admin/users/$id                         → user edit
/admin/settings/                         → CMS settings
```

Four route templates cover everything: **list**, **create**, **edit**, **singleton**. The `$collectionSlug` / `$documentSlug` params resolve config from the module registry at load time.

---

## Field Admin Config

Fields can declare sidebar placement:

```ts
{ name: 'status', type: 'select', options: ['draft', 'published'], admin: { sidebar: true } }
```

Admin form layout:
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
- [ ] `@latha/core` — types, `defineConfig()`, Zod schema builder, module registry skeleton
- [ ] `@latha/storage` — `DBAdapter` implementation for Drizzle + Turso
- [ ] `apps/playground` — TanStack Start app consuming `@latha/core`
- [ ] One hardcoded `posts` Collection wired end-to-end (server fn → DB → response)

### Phase 2 — Config-Driven API
- [ ] Module registry + resolution order
- [ ] `@latha/content` — `ContentModule`, `Collection`, `Document`, `Taxonomy`
- [ ] Config → Drizzle schema generation (`migrate()`)
- [ ] Config → server functions (list, findOne, create, update, delete per collection)
- [ ] Access control evaluator
- [ ] Hook engine (before/after lifecycle)

### Phase 3 — Admin UI Shell
- [ ] `@latha/ui` package setup (Tailwind + shadcn/ui base, design tokens, primitives)
- [ ] `@latha/admin-sdk` package setup — depends on `@latha/ui` and `@latha/core`
- [ ] Admin shell layout (sidebar + topbar) in `admin-sdk`
- [ ] Sidebar derived from module registry
- [ ] TanStack Router admin routes
- [ ] Field renderer registry
- [ ] Auto-generated collection list view (table)
- [ ] Auto-generated collection form (TanStack Form + Zod)
- [ ] Singleton document form

### Phase 4 — Auth + Users
- [ ] `@latha/auth` — session-based auth, login/logout
- [ ] `@latha/users` — user management, role system
- [ ] Auth middleware on admin routes and server functions

### Phase 5 — Media
- [ ] `@latha/media` — MediaModule
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
│   ├── config.ts       ← LathaConfig, CMSModule, CMSPlugin
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
    └── index.ts        ← defineConfig(), CMSInstance

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

packages/admin-sdk/src/
├── index.ts
├── shell/
│   ├── AdminShell.tsx  ← depends on @latha/ui + @latha/core registry
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
- Phase 1 first — no admin UI until the kernel works end-to-end.
- The entry point is `defineConfig()` from `@latha/core` — not `defineCMS`.
- Zod is the single validation layer. Do not add separate validation logic anywhere.
- All DB access goes through `DBAdapter` from `@latha/storage` — never call Drizzle directly from app code.
- Server functions (not API routes) are the API layer. Keep them in `packages/` where possible so they're reusable.
- All modules live under `packages/modules/*` — never at the root of `packages/`.
- Admin UI is split into two packages: `@latha/ui` (dumb design system, no CMS knowledge) and `@latha/admin-sdk` (CMS-aware, builds on top of `@latha/ui`). Never put CMS logic in `@latha/ui`.
- Keep `apps/playground` thin — it should only wire together packages, not contain business logic.
- Prefer explicit types over inference where it aids readability in core packages.
- When in doubt, refer to how Payload CMS v3 solves the same problem — then do it the TanStack way.
