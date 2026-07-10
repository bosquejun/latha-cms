# Kon10

> A config-driven, modular headless CMS built on TanStack Start.

Kon10 is an open-source headless CMS framework built on TanStack Start.
Everything is a module, and modules are composed via a single config file.

- **Concepts** — [taxonomy](./docs/concepts/taxonomy.md) (vocabulary),
  [entities](./docs/concepts/entities.md) (content model),
  [frameworks](./docs/concepts/frameworks.md) (the `@kon10/start` integration).
- **Architecture & roadmap** — [`SPEC.md`](./SPEC.md).

## Status

**Phase 1 — Foundation ✅** · **Phase 2 — Config-Driven API ✅** · **Phase 3 — Studio UI Shell ✅** · **Phase 4 — Auth + Users ✅**

The kernel works end-to-end for all three entity kinds, and a fully
auto-generated Studio UI is layered on top: config → schema → API → DB → Studio.

Phase 1:
- [x] Monorepo scaffold (pnpm workspaces + Turborepo)
- [x] `@kon10/core` — types, `defineConfig()`, Zod schema builder, module
      registry (topological resolution), hook engine, access evaluator, local
      CRUD operations
- [x] `@kon10/storage` — `DBAdapter` for libsql/Turso, dynamic schema
      generation, value marshalling
- [x] `apps/playground` — TanStack Start app consuming the kernel

Phase 2:
- [x] `@kon10/content` — `ContentModule`, `Collection()`, `Document()`,
      `Taxonomy()` factories
- [x] Config → schema generation for collections, document singletons, and
      taxonomies (`migrate()`)
- [x] Config-driven server functions — one generic set, parameterized by
      entity slug, gives every entity full CRUD (list, findOne, create, update,
      delete) plus singleton upsert and taxonomy tree
- [x] Access evaluator + hook engine wired through every operation

Phase 3:
- [x] `@kon10/ui` — design system on shadcn/ui (new-york) + Tailwind v4 tokens;
      pure, CMS-unaware primitives
- [x] `@kon10/studio-sdk` — Studio shell, registry-driven sidebar, field renderer
      registry, and auto-generated list / form / singleton views (TanStack Form
      + the same Zod schema)
- [x] TanStack Router Studio routes — dashboard, collection list/create/edit,
      document singleton — all derived from the config

Phase 4:
- [x] `@kon10/users` — `UsersModule`, the `users` collection, and a role system
- [x] `@kon10/auth` — `AuthModule`, session-based auth with edge-friendly
      password hashing (PBKDF2) and signed session tokens (HMAC), all on Web
      Crypto — no native deps
- [x] Auth wired through the stack: login/logout, a first-run admin seed,
      `/studio` guarded behind a session, and per-collection access rules
      (`read`/`create`/`update`/`delete`) enforced against the real user

> Notes: the current TanStack Start (v1.168+) uses a Vite plugin rather than the
> Vinxi `app.config.ts` shown in `SPEC.md`; the playground follows the current
> approach. The public types dropped the `CMS` prefix (`Module`, `Plugin`,
> `Kon10Instance`).

## Packages

| Package | Path | Responsibility |
|---|---|---|
| `@kon10/core` | `packages/core` | Kernel — types, `defineConfig`, registry, hooks, access, Zod builder, operations |
| `@kon10/ui` | `packages/ui` | Design system — shadcn/ui primitives + tokens. No CMS knowledge. |
| `@kon10/studio-sdk` | `packages/studio-sdk` | CMS-aware Studio layer — shell, field renderers, auto-generated views |
| `@kon10/start` | `packages/start` | TanStack Start integration — runtime, RPC dispatcher, typed client, and the mountable Studio/login UI |
| `@kon10/content` | `packages/modules/content` | `ContentModule`, `Collection`/`Document`/`Taxonomy`, config-driven content API |
| `@kon10/auth` | `packages/modules/auth` | `AuthModule`, session auth, password hashing, login/logout helpers |
| `@kon10/users` | `packages/modules/users` | `UsersModule`, the `users` collection, roles |
| `@kon10/storage` | `packages/modules/storage` | `DBAdapter` — libsql/Turso (default), dynamic SQLite schema |
| `@kon10/playground` | `apps/playground` | TanStack Start dev/test harness |

## Getting started

```bash
pnpm install        # install workspace deps
pnpm build          # build every package
pnpm dev            # run the playground at http://localhost:3000
```

The playground defaults to a local SQLite file (`file:local.db`). Point it at
Turso in production via `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`.

On first run it seeds an admin user so you can sign in at `/studio`:

```
email:    admin@kon10.dev   (override with ADMIN_EMAIL)
password: password          (override with ADMIN_PASSWORD)
```

Set `AUTH_SECRET` in production to sign session tokens (a dev fallback is used
otherwise).

## The config

```ts
import { defineConfig } from '@kon10/core'
import { tursoAdapter } from '@kon10/storage'
import { Collection, ContentModule, Document, Taxonomy } from '@kon10/content'

export const kon10Config = defineConfig({
  db: tursoAdapter({ url: process.env.TURSO_DATABASE_URL ?? 'file:local.db' }),
  modules: [
    ContentModule({
      entities: [
        Document({
          slug: 'site-settings',
          fields: [{ name: 'site_name', type: 'text', required: true }],
        }),
        Collection({
          slug: 'posts',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'slug', type: 'text', unique: true },
            { name: 'status', type: 'select', options: ['draft', 'published'] },
          ],
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
the runtime, the API, auth, and the Studio UI. The `kon10Start()` Vite plugin
injects the framework's `/login` and `/studio/$` routes, so the app ships no
boilerplate route files for them — `src/routes/` holds only the app's own pages:

```
your-app/
├── kon10.config.ts            # ★ the entrypoint — defineConfig({ ... })
├── vite.config.ts             # plugins: [..., kon10Start(), viteReact()]
└── src/
    ├── rpc.ts                 # one server fn → handleKon10Request(config, data)
    ├── kon10-client.ts        # createKon10Client(serverFn)
    └── routes/
        ├── __root.tsx         # <Kon10Provider client={kon10}>…</Kon10Provider>
        └── index.tsx          # the app's own landing page (anything you like)
```

```ts
// vite.config.ts — kon10Start() wraps tanstackStart() and adds /login + /studio/$
import { defineConfig } from 'vite'
import { kon10Start } from '@kon10/start/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [kon10Start(), viteReact()],
})
```

Prefer to keep the routes explicit? Skip the plugin and mount them with a
one-line re-export instead — the route definitions still live in the framework:

```tsx
// src/routes/login.tsx
export { Route } from '@kon10/start/routes/login'
// src/routes/studio.$.tsx
export { Route } from '@kon10/start/routes/studio'
```

```ts
// src/rpc.ts — the app's only server endpoint (not `server.ts`: that name is
// reserved by TanStack Start for its SSR server entry)
import { createServerFn } from '@tanstack/react-start'
import type { Kon10RpcInput } from '@kon10/start'
import config from '../kon10.config'

export const kon10Rpc = createServerFn({ method: 'POST' })
  .validator((data: Kon10RpcInput) => data)
  .handler(async ({ data }) => {
    const { handleKon10Request } = await import('@kon10/start/server')
    return handleKon10Request(config, data)
  })
```

`Kon10Studio` (mounted at `/studio/$`) derives the sidebar, list views, and forms
from the config, guards the session, and routes internally — there is no
per-collection app code. The server endpoint stays in the app because TanStack
Start requires `createServerFn` to live in app-compiled code; the route tree,
Studio, and login all come from the framework via `kon10Start()`.

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

## Next

Phase 5 — Media: `@kon10/media` (MediaModule), an R2 storage adapter, the media
library UI, and a media field renderer. See `SPEC.md`.

## License

MIT
