# LathaCMS 🇵🇭

> A config-driven, modular headless CMS built on TanStack Start.
> *Latha* comes from the Filipino word *lathala* — to publish.

LathaCMS is an open-source headless CMS framework built on TanStack Start.
Everything is a module, and modules are composed via a single config file.
See [`SPEC.md`](./SPEC.md) for the full architecture and roadmap.

## Status — Phase 1 (Foundation) ✅

The kernel works end-to-end: config → schema → API → DB.

- [x] Monorepo scaffold (pnpm workspaces + Turborepo)
- [x] `@latha/core` — types, `defineConfig()`, Zod schema builder, module
      registry (topological resolution), hook engine, access evaluator, and
      the local CRUD operations layer
- [x] `@latha/storage` — `DBAdapter` for libsql/Turso, dynamic schema
      generation, value marshalling
- [x] `apps/playground` — TanStack Start app consuming the kernel
- [x] One `posts` Collection wired end-to-end (server fn → operations → DB)

> Note: the current TanStack Start (v1.168+) uses a Vite plugin rather than the
> Vinxi `app.config.ts` shown in `SPEC.md`; the playground follows the current
> approach.

## Packages

| Package | Path | Responsibility |
|---|---|---|
| `@latha/core` | `packages/core` | Kernel — types, `defineConfig`, registry, hooks, access, Zod builder, operations |
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

## The config (Phase 1)

```ts
import { defineConfig } from '@latha/core'
import { tursoAdapter } from '@latha/storage'

export const cmsConfig = defineConfig({
  db: tursoAdapter({ url: process.env.TURSO_DATABASE_URL ?? 'file:local.db' }),
  modules: [
    {
      name: 'content',
      entities: [
        {
          kind: 'collection',
          slug: 'posts',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'slug', type: 'text', unique: true },
            { name: 'status', type: 'select', options: ['draft', 'published'] },
          ],
        },
      ],
    },
  ],
})
```

Field definitions compile to a Zod schema that drives API validation, form
validation, and TypeScript inference simultaneously — Zod is the single
validation layer.

## Next

Phase 2 — Config-Driven API: `@latha/content` (`ContentModule`, `Collection`,
`Document`, `Taxonomy`) and config-generated server functions. See `SPEC.md`.

## License

MIT
