# LathaCMS 🇵🇭

> A config-driven, modular headless CMS built on TanStack Start.
> *Latha* comes from the Filipino word *lathala* — to publish.

LathaCMS is an open-source headless CMS framework built on TanStack Start.
Everything is a module, and modules are composed via a single config file.
See [`SPEC.md`](./SPEC.md) for the full architecture and roadmap.

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
the runtime, the API, auth, and the admin UI — so the app is just the config
plus a one-line server endpoint and a couple of mount points:

```
your-app/
├── latha.config.ts            # ★ the entrypoint — defineConfig({ ... })
└── src/
    ├── server.ts              # one server fn → handleLathaRequest(config, data)
    ├── latha.client.ts        # createLathaClient(serverFn)
    └── routes/
        ├── __root.tsx         # <LathaProvider client={latha}>…</LathaProvider>
        ├── login.tsx          # component: LathaLogin
        └── admin.$.tsx        # component: LathaAdmin   (catch-all; routes itself)
```

```ts
// src/server.ts — the app's only server endpoint
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

```tsx
// src/routes/admin.$.tsx — the whole admin behind one route
import { createFileRoute } from '@tanstack/react-router'
import { LathaAdmin } from '@latha/start'

export const Route = createFileRoute('/admin/$')({ component: LathaAdmin })
```

`LathaAdmin` derives the sidebar, list views, and forms from the config, guards
the session, and routes internally — there is no per-collection app code. (The
split exists because TanStack Start requires `createServerFn` and the route tree
to live in app-compiled code; everything else lives in the framework.)

## Next

Phase 5 — Media: `@latha/media` (MediaModule), an R2 storage adapter, the media
library UI, and a media field renderer. See `SPEC.md`.

## License

MIT
