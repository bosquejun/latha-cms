# LathaCMS 🇵🇭

> A config-driven, modular headless CMS built on TanStack Start.
> *Latha* comes from the Filipino word *lathala* — to publish.

LathaCMS is an open-source headless CMS framework built on TanStack Start.
Everything is a module, and modules are composed via a single config file.

- **Concepts** — [taxonomy](./docs/concepts/taxonomy.md) (vocabulary),
  [entities](./docs/concepts/entities.md) (content model),
  [frameworks](./docs/concepts/frameworks.md) (the `@latha/start` integration).
- **Architecture & roadmap** — [`SPEC.md`](./SPEC.md).

## Status

**Phase 1 — Foundation ✅** · **Phase 2 — Config-Driven API ✅** · **Phase 3 — Admin UI Shell ✅** · **Phase 4 — Auth + Users ✅**

The kernel works end-to-end for all three entity kinds, and a fully
auto-generated admin UI is layered on top: config → schema → API → DB → admin.

Phase 1:
- [x] Monorepo scaffold (pnpm workspaces + Turborepo)
- [x] `@latha/core` — types, `defineConfig()`, Zod schema builder, module
      registry (topological resolution), hook engine, access evaluator, local
      CRUD operations
- [x] `@latha/storage` — `DBAdapter` for libsql/Turso, dynamic schema
      generation, value marshalling
- [x] `apps/playground` — TanStack Start app consuming the kernel

Phase 2:
- [x] `@latha/content` — `ContentModule`, `Collection()`, `Document()`,
      `Taxonomy()` factories
- [x] Config → schema generation for collections, document singletons, and
      taxonomies (`migrate()`)
- [x] Config-driven server functions — one generic set, parameterized by
      entity slug, gives every entity full CRUD (list, findOne, create, update,
      delete) plus singleton upsert and taxonomy tree
- [x] Access evaluator + hook engine wired through every operation

Phase 3:
- [x] `@latha/ui` — design system on shadcn/ui (new-york) + Tailwind v4 tokens;
      pure, CMS-unaware primitives
- [x] `@latha/admin-sdk` — admin shell, registry-driven sidebar, field renderer
      registry, and auto-generated list / form / singleton views (TanStack Form
      + the same Zod schema)
- [x] TanStack Router admin routes — dashboard, collection list/create/edit,
      document singleton — all derived from the config

Phase 4:
- [x] `@latha/users` — `UsersModule`, the `users` collection, and a role system
- [x] `@latha/auth` — `AuthModule`, session-based auth with edge-friendly
      password hashing (PBKDF2) and signed session tokens (HMAC), all on Web
      Crypto — no native deps
- [x] Auth wired through the stack: login/logout, a first-run admin seed,
      `/admin` guarded behind a session, and per-collection access rules
      (`read`/`create`/`update`/`delete`) enforced against the real user

> Notes: the current TanStack Start (v1.168+) uses a Vite plugin rather than the
> Vinxi `app.config.ts` shown in `SPEC.md`; the playground follows the current
> approach. The public types dropped the `CMS` prefix (`Module`, `Plugin`,
> `LathaInstance`).

## Packages

| Package | Path | Responsibility |
|---|---|---|
| `@latha/core` | `packages/core` | Kernel — types, `defineConfig`, registry, hooks, access, Zod builder, operations |
| `@latha/ui` | `packages/ui` | Design system — shadcn/ui primitives + tokens. No CMS knowledge. |
| `@latha/admin-sdk` | `packages/admin-sdk` | CMS-aware admin layer — shell, field renderers, auto-generated views |
| `@latha/start` | `packages/start` | TanStack Start integration — runtime, RPC dispatcher, typed client, and the mountable admin/login UI |
| `@latha/content` | `packages/modules/content` | `ContentModule`, `Collection`/`Document`/`Taxonomy`, config-driven content API |
| `@latha/auth` | `packages/modules/auth` | `AuthModule`, session auth, password hashing, login/logout helpers |
| `@latha/users` | `packages/modules/users` | `UsersModule`, the `users` collection, roles |
| `@latha/storage` | `packages/modules/storage` | `DBAdapter` — libsql/Turso (default), dynamic SQLite schema |
| `@latha/playground` | `apps/playground` | TanStack Start dev/test harness |

## Getting started

```bash
pnpm install        # install workspace deps
pnpm build          # build every package
pnpm dev            # run the playground at http://localhost:3000
```

The playground defaults to a local SQLite file (`file:local.db`). Point it at
Turso in production via `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`.

On first run it seeds an admin user so you can sign in at `/admin`:

```
email:    admin@latha.dev   (override with ADMIN_EMAIL)
password: password          (override with ADMIN_PASSWORD)
```

Set `AUTH_SECRET` in production to sign session tokens (a dev fallback is used
otherwise).

## The config

```ts
import { defineConfig } from '@latha/core'
import { tursoAdapter } from '@latha/storage'
import { Collection, ContentModule, Document, Taxonomy } from '@latha/content'

export const lathaConfig = defineConfig({
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

## How a consuming app uses LathaCMS

The config is the single entrypoint. `@latha/start` provides everything else —
the runtime, the API, auth, and the admin UI. The `lathaStart()` Vite plugin
injects the framework's `/login` and `/admin/$` routes, so the app ships no
boilerplate route files for them — `src/routes/` holds only the app's own pages:

```
your-app/
├── latha.config.ts            # ★ the entrypoint — defineConfig({ ... })
├── vite.config.ts             # plugins: [..., lathaStart(), viteReact()]
└── src/
    ├── rpc.ts                 # one server fn → handleLathaRequest(config, data)
    ├── latha-client.ts        # createLathaClient(serverFn)
    └── routes/
        ├── __root.tsx         # <LathaProvider client={latha}>…</LathaProvider>
        └── index.tsx          # the app's own landing page (anything you like)
```

```ts
// vite.config.ts — lathaStart() wraps tanstackStart() and adds /login + /admin/$
import { defineConfig } from 'vite'
import { lathaStart } from '@latha/start/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [lathaStart(), viteReact()],
})
```

Prefer to keep the routes explicit? Skip the plugin and mount them with a
one-line re-export instead — the route definitions still live in the framework:

```tsx
// src/routes/login.tsx
export { Route } from '@latha/start/routes/login'
// src/routes/admin.$.tsx
export { Route } from '@latha/start/routes/admin'
```

```ts
// src/rpc.ts — the app's only server endpoint (not `server.ts`: that name is
// reserved by TanStack Start for its SSR server entry)
import { createServerFn } from '@tanstack/react-start'
import type { LathaRpcInput } from '@latha/start'
import config from '../latha.config'

export const lathaRpc = createServerFn({ method: 'POST' })
  .validator((data: LathaRpcInput) => data)
  .handler(async ({ data }) => {
    const { handleLathaRequest } = await import('@latha/start/server')
    return handleLathaRequest(config, data)
  })
```

`LathaAdmin` (mounted at `/admin/$`) derives the sidebar, list views, and forms
from the config, guards the session, and routes internally — there is no
per-collection app code. The server endpoint stays in the app because TanStack
Start requires `createServerFn` to live in app-compiled code; the route tree,
admin, and login all come from the framework via `lathaStart()`.

> **On the package name:** `@latha/start` mirrors the framework it integrates
> (TanStack Start) and stays short. Adapter-style alternatives like
> `@latha/react-start` or `@latha/tanstack-start` were considered; the name was
> kept since LathaCMS is defined as "built on TanStack Start."

## Customizing the admin

The auto-generated admin is extensible through a structured set of **injection
zones** and **custom pages** — the LathaCMS take on Medusa's admin extensions.
Drop files under `src/admin/` and the `lathaStart()` Vite plugin auto-collects
them into `virtual:latha/admin-extensions`, which you hand to the provider:

```tsx
import { LathaProvider } from '@latha/start'
import { adminExtensions } from 'virtual:latha/admin-extensions'

<LathaProvider client={latha} extensions={adminExtensions}>…</LathaProvider>
```

```tsx
// src/admin/widgets/post-tips.tsx — a widget in the form sidebar
import { defineWidgetConfig, type WidgetContext } from '@latha/start'

export const config = defineWidgetConfig({ zone: 'form.sidebar.before' })
export default function PostTips({ entity }: WidgetContext) { … }
```

Six surfaces are supported: **widgets** (injected into named zones like
`shell.topbar.start`, `list.after`, `form.sidebar.before`), **custom pages**,
**dashboard widgets**, **settings pages**, **field-renderer overrides**, and
**nav links**. The engine is a plain registry, so you can also pass an
`extensions` object built by hand with `defineAdminExtensions` — no Vite plugin
required.

The sidebar groups entities into **sections by their contributing module**
(ContentModule → "Content", UsersModule → "Users", …); modules set their heading
via `admin.nav`, and any entity can override its section with `admin.group`.
Full guide: [`docs/admin-extensions.md`](./docs/admin-extensions.md).

## Next

Phase 5 — Media: `@latha/media` (MediaModule), an R2 storage adapter, the media
library UI, and a media field renderer. See `SPEC.md`.

## License

MIT
