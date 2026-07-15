# RFC: Headless API Client & Template Distribution via shadcn Registry

**Status:** Draft
**Scope:** New `@kon10/client` package, a delivery-API schema manifest + `kon10 typegen`, and a shadcn-registry-based template distribution system.
**Audience:** Kon10 maintainers.

---

## 1. Motivation

Kon10 already ships a complete headless read surface (`@kon10/start/src/api.ts`): a
public content delivery API at `/api/v1/<prefix>/<slug>` with a uniform response
envelope, RBAC, CORS, caching, and list querying. What it does **not** have is a
way for a *website* — built by a developer who is not us — to consume that content
with a typed client and a ready-made design, then own and customize the result.

The goal: a **website template system**. A developer picks a template ("blog",
"docs", "marketing"), pulls it into their own repo, points it at their Kon10
Studio's delivery API, and gets a rendered site. Distribution is **dev-first**:
templates are copied into the developer's repository via the
[shadcn registry](https://ui.shadcn.com/docs/registry) mechanism
(`npx shadcn@latest add <url>`), so the developer owns the source and can edit it
freely — not a black-box npm dependency.

This mirrors how shadcn/ui itself distributes components, and it fits Kon10's
existing shape: `@kon10/ui` is already a shadcn-style design system
(`components.json`, `new-york` style, `neutral` base, CSS variables, lucide icons).

---

## 2. Current State (what we build on)

| Capability | Where | Notes |
|---|---|---|
| Delivery API (read) | `packages/start/src/api.ts` | `GET /api/v1/<prefix>/<slug>` list / `:id` / singleton. `sort`, `where[field]`, `page`/`pageSize`. RBAC + API keys (`kon10_…`) + Public role. CORS + TTL cache. |
| Response envelope | `packages/start/src/envelope.ts` | `{ data, error, pagination? }`. Zod-first: `apiResponseSchema()` + `ApiResponse<T>`. |
| Studio RPC client | `packages/studio-sdk/src/client/client.ts` | `createKon10Client()` — talks to the **admin RPC** (cookie auth), **not** the public `/api/v1` surface. Not reusable for public sites. |
| Design system | `packages/ui` | `@kon10/ui` — CMS-unaware shadcn primitives + tokens. Already `components.json`-shaped. |
| Entity/field model | `packages/core` | Zod-first field registry; each field type has `configSchema` + `buildDataSchema`. Entities carry `cardinality`, `kind`, `api.where`. |
| App scaffolding | `packages/create-kon10-app` | Scaffolds the **CMS/Studio** app, not consumer sites. |

**Three gaps** stand between this and a template ecosystem:

1. **No public delivery client.** The only client targets the admin RPC.
2. **No typing bridge.** Entity shapes live in the developer's `kon10.config.ts`
   at runtime; nothing emits per-entity types a template author can import.
3. **No distribution mechanism.** No `registry.json`, no template packaging.

---

## 3. Design

Three pieces, each respecting the separation-of-concerns wall in `CLAUDE.md`.

### 3.1 `@kon10/client` — the headless delivery SDK (new package)

A tiny, **CMS-unaware** package that wraps the delivery API and nothing else. It
knows the *envelope contract* — the same discipline as `@kon10/cache` (a cache
adapter never knows what is being cached). It must not depend on
`@kon10/content`, `@kon10/auth`, or any module; dependency direction stays inward.

```ts
import { createDeliveryClient } from '@kon10/client'

const kon10 = createDeliveryClient({
  baseUrl: 'https://cms.example.com',   // origin hosting /api/v1
  apiKey: process.env.KON10_API_KEY,    // optional; anonymous = Public role
  basePath: '/api/v1',                  // default
})

const { data, pagination } = await kon10.list('contents/posts', {
  page: 1, pageSize: 20, sort: '-createdAt', where: { status: 'published' },
})
const post = await kon10.get('contents/posts', id)   // null on 404
const settings = await kon10.single('site/settings')  // singleton entity
```

Responsibilities:
- Wrap `fetch`; build the URL from `prefix/slug` + query params (mirrors the
  server's parsing in `api.ts`).
- Validate every response with `apiResponseSchema(dataSchema)` and surface the
  envelope's typed `ApiError` codes on failure. Typed schemas come from typegen
  (§3.2); untyped calls fall back to a permissive `JsonDoc` schema.
- Send `Authorization: Bearer <apiKey>` when provided.
- Optional `@kon10/client/react` entry: `useList` / `useDoc` / `useSingle`
  hooks (thin, or TanStack-Query-friendly), since templates are React-first.

**Envelope relocation.** `apiResponseSchema` / `ApiResponse` / `apiErrorSchema`
currently live in `@kon10/start/envelope`. The client cannot depend on
`@kon10/start` (server integration). Move the envelope contract into
`@kon10/client` as its neutral home, and have `@kon10/start` import it from
there. This keeps one Zod source of truth for the wire format shared by both
sides. (Alternative: park the envelope in `@kon10/core`; rejected because the
envelope is a delivery-API concern, not a kernel primitive.)

### 3.2 Typing bridge — schema manifest + `kon10 typegen`

Selected approach: **manifest endpoint + codegen** (fully Zod-first, best DX).

**(a) Manifest endpoint.** Add `GET /api/v1/_manifest` to `api.ts`. It returns,
for every entity the caller is allowed to read, the serialized field configs plus
structural metadata:

```jsonc
{
  "data": {
    "entities": [
      {
        "prefix": "contents",           // moduleApiPrefix(module)
        "slug": "posts",
        "cardinality": "many",          // 'many' | 'single'
        "kind": "collection",           // opaque module tag
        "fields": [                     // each field's inferred configSchema value
          { "type": "text", "name": "title", "minLength": 1 },
          { "type": "richtext", "name": "body" }
        ]
      }
    ]
  },
  "error": null
}
```

The runtime already holds every entity and can serialize field configs (they are
plain, Zod-validated objects). Hidden fields (`meta.hidden`, e.g. credential
material) are omitted, exactly as the read surface omits them today
(`hiddenFieldNames` / `projectDoc`). The manifest is subject to the same RBAC as
reads, so it never leaks entities the caller cannot see.

**(b) `kon10 typegen` CLI.** A codegen command that reads the manifest (remote
URL) or the resolved config directly (local), and emits per-entity **Zod schemas
+ inferred types** into the consumer's repo:

```ts
// kon10.gen.ts (generated — do not edit)
import { z } from 'zod'
export const postSchema = z.object({ title: z.string().min(1), body: z.string(), /* … */ })
export type Post = z.infer<typeof postSchema>
export const entities = { 'contents/posts': postSchema, /* … */ } as const
```

Generation reuses the field registry's `buildDataSchema` semantics so the emitted
Zod matches what the server validates — the "Zod is the single source of truth"
rule holds across the network boundary. The client's generics bind to these:

```ts
import { entities, type Post } from './kon10.gen'
const client = createDeliveryClient({ baseUrl, schemas: entities })
const posts = await client.list('contents/posts')  // typed as Post[]
```

**(c) Generic fallback.** Until typegen is run, `list`/`get`/`single` return
`JsonDoc` (`Record<string, unknown>`) and validate against a permissive envelope.
Templates work generically first, then upgrade to typed once `typegen` lands.

### 3.3 Templates as a shadcn registry

A shadcn registry is static JSON: a `registry.json` index plus per-item files
conforming to `registry-item.json`. Developers consume with:

```bash
npx shadcn@latest add https://kon10.dev/r/blog.json
```

which **copies source files into their repo** — the dev-first ownership model.

Template items are layered by registry item type:

| Layer | Item type | Contents |
|---|---|---|
| Data | `registry:lib` | `@kon10/client` setup, `kon10.gen.ts` wiring, env conventions. |
| Primitives | `registry:ui` | Mirror of `@kon10/ui` primitives, so `registryDependencies` resolve (same pattern shadcn/ui uses for its own registry). |
| Template | `registry:block` / `registry:page` | The actual site: route/page files placed via `target`, npm `dependencies`, `registryDependencies`, `cssVars` / `tailwind` theme. |

A template (e.g. `blog`) is a `registry:block` that:
- ships route files (blog index, post detail) via each file's `target`,
- lists npm `dependencies` (client, tanstack query, etc.),
- lists `registryDependencies` for the UI primitives + data lib it composes,
- carries `cssVars` / `tailwind` for its theme.

**Hosting.** Serve the registry JSON from a small app (`apps/registry`, or fold
into the docs site). A build step generates `registry.json` + `/r/*.json` from a
`registry/` source tree that holds the real, type-checked template source (so
templates are lint/build-tested in CI like any package, not hand-authored JSON).

---

## 4. Proposed Layout

```
packages/client/            @kon10/client — delivery SDK + envelope contract (new home)
  src/index.ts              createDeliveryClient, envelope schemas, types
  src/react.ts              useList / useDoc / useSingle
packages/cli/               kon10 typegen  (new, or extend an existing CLI)
packages/start/src/api.ts   + GET /api/v1/_manifest
registry/                   template source tree (blog/, docs/, marketing/…), type-checked
apps/registry/              builds + serves registry.json + /r/*.json  (or fold into docs)
```

`@kon10/ui` stays CMS-unaware; templates compose it. No new cross-module import
is introduced: the client depends only on the envelope contract, never on a
module.

---

## 5. Data Flow

```
kon10.config.ts ──(runtime)──> @kon10/start /api/v1 ──HTTP──> @kon10/client ──> Template (routes + @kon10/ui)
        │                              │
        └──> GET /api/v1/_manifest ────┴──> kon10 typegen ──> kon10.gen.ts (Zod + types) ──> binds client generics
```

Distribution is orthogonal to the request path: `npx shadcn add` copies the
template + client + UI source into the developer's repo once; from then on the
running site talks to the delivery API directly.

---

## 6. Phased Roadmap

1. **Envelope relocation + `@kon10/client`.** Move `apiResponseSchema` et al. into
   the neutral package; ship `createDeliveryClient` (generic-typed) against
   `/api/v1`. Smallest useful unit — immediately usable by hand-written sites.
2. **`_manifest` endpoint.** Serialize entity/field configs from the runtime,
   RBAC-scoped, hidden fields omitted.
3. **`kon10 typegen`.** Manifest → Zod + inferred types in the consumer repo;
   wire the client's generics to the generated `entities` map.
4. **Registry scaffolding.** `registry.json` + build pipeline + hosting; mirror
   `@kon10/ui` primitives as `registry:ui` items.
5. **First template — `blog`.** A `registry:block` composing client + typed
   content + UI, installable end-to-end via `npx shadcn add`.
6. **Template gallery + scaffolder.** `docs`, `marketing`, etc.; a
   `create-kon10-site` command (or a `--template` flag) paralleling
   `create-kon10-app`.

---

## 7. Open Questions

- **CLI home:** new `packages/cli` vs. extending `create-kon10-app`'s bin.
- **React data layer:** ship our own hooks vs. lean on TanStack Query as a peer.
- **Registry hosting:** standalone `apps/registry` vs. a route in the docs site.
- **Versioning:** how a template pins a compatible `@kon10/client` / manifest
  shape as entities evolve (manifest could carry a schema version).
- **Preview/ISR:** whether templates get a draft-preview path (delivery API today
  serves only the entity's `api.where` constraint, e.g. `status: 'published'`).
