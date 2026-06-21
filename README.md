# LathaCMS 🇵🇭

> A config-driven, modular headless CMS built on TanStack Start.
> *Latha* comes from the Filipino word *lathala* — to publish.

LathaCMS is an open-source headless CMS framework built on TanStack Start.
Everything is a module, and modules are composed via a single config file.
See [`SPEC.md`](./SPEC.md) for the full architecture and roadmap.

## Status

**Phase 1 — Foundation ✅** · **Phase 2 — Config-Driven API ✅**

The kernel works end-to-end for all three entity kinds: config → schema → API → DB.

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

> Note: the current TanStack Start (v1.168+) uses a Vite plugin rather than the
> Vinxi `app.config.ts` shown in `SPEC.md`; the playground follows the current
> approach.

## Packages

| Package | Path | Responsibility |
|---|---|---|
| `@latha/core` | `packages/core` | Kernel — types, `defineConfig`, registry, hooks, access, Zod builder, operations |
| `@latha/content` | `packages/modules/content` | `ContentModule`, `Collection`/`Document`/`Taxonomy`, config-driven content API |
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

## The config

```ts
import { defineConfig } from '@latha/core'
import { tursoAdapter } from '@latha/storage'
import { Collection, ContentModule, Document, Taxonomy } from '@latha/content'

export const cmsConfig = defineConfig({
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

## Next

Phase 3 — Admin UI Shell: `@latha/ui` (design system) and `@latha/admin-sdk`
(CMS-aware shell, field renderers, auto-generated list/form views). See
`SPEC.md`.

## License

MIT
