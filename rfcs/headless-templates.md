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

**Multi-framework is a first-class constraint, not an afterthought.** We must be
able to ship the same template concept ("blog") for Vite + TanStack Start, Next.js,
Vue/Nuxt, and beyond. To keep that tractable, every layer of the design is graded
by how portable it is (§3.4): the data/typing core is framework-agnostic, and only
the outermost routing/rendering shell is framework-specific. **Vite + TanStack
Start (React) is the default target** and the first template we ship; other
frameworks follow the same layering.

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

The **core is pure TypeScript** (`fetch` + Zod) with zero framework imports, so it
runs unchanged under React, Vue, or a plain Node build step — and is directly
useful on its own (TanStack loaders, React Server Components, Node scripts call it
without any hook layer). Reactive bindings are **separate packages** over that same
core, following the TanStack Query model (`query-core` + `react-query` +
`vue-query`), which is already the pattern in this stack:

| Package | Contains | Framework peer |
|---|---|---|
| `@kon10/client` | Framework-agnostic core — `createDeliveryClient`, envelope schema, generics | none |
| `@kon10/client-react` | `useList` / `useDoc` / `useSingle` hooks (ships first) | `react` |
| `@kon10/client-vue` | Equivalent composables (with the Vue template) | `vue` |

Separate packages rather than subpath exports of one package, for two concrete
reasons:

1. **Peer-dependency isolation.** A single package declaring both `react` and
   `vue` as peers forces "missing peer" noise on every app that uses only one, and
   makes both framework typings visible everywhere. Each binding package declares
   only its own peer.
2. **Independent release cadence.** A Vue-binding fix must not bump the version
   React consumers see.

A binding depends on `@kon10/client` and only wraps it; new UI-library bindings
never touch the core. A plain content site can install just `@kon10/client`.

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

The shadcn registry format is React + Tailwind oriented, so a single registry
serves every React framework (Vite/TanStack, Next.js). The Vue track's
meta-framework, Nuxt, gets its own namespace and uses the parallel
[shadcn-vue](https://www.shadcn-vue.com/) component format; we treat it as a
second registry namespace, not a blocker (§3.4). Templates are **namespaced by
meta-framework** — not by bundler or UI library — because their routing/rendering
shells are what differ:

```
/r/tanstack/blog.json      # default (TanStack Start — Vite + TanStack Router)
/r/next/blog.json          # Next.js
/r/nuxt/blog.json          # Nuxt (Vue SFC + shadcn-vue components)
```

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

### 3.4 Multi-framework strategy

The template concept must survive Vite/TanStack, Next.js, and Vue/Nuxt. The key is
to grade every layer by portability and push framework-specific code to the thin
outer shell only:

| Layer | Portability | Per-framework work |
|---|---|---|
| `@kon10/client` core (fetch + Zod envelope) | All JS frameworks | None — pure TS. |
| `kon10 typegen` output (Zod + inferred types) | All JS frameworks | None — plain schemas. |
| Client binding (`client-react` hooks, `client-vue` composables) | Per UI library | One thin adapter package per UI library (React, Vue). |
| Presentational components | Per UI library | Parallel implementations: JSX for React, SFC for Vue. Same props/design tokens, different syntax. |
| Template shell — routing, data loading, SEO/meta | Per framework | TanStack file routes + loaders vs. Next app/pages vs. Nuxt pages. The only genuinely framework-specific surface. |

Consequences:
- **One data/typing spine** (`@kon10/client` core + `typegen`) is shared by every
  framework; we never re-solve fetching or typing per framework.
- **React frameworks share the shadcn registry and JSX components**; TanStack vs.
  Next differ only in the route/loader shell, so a Next template reuses most of a
  TanStack template's non-route files.
- **Vue is additive, not a fork of core.** It reuses the client core + generated
  types, adds the `@kon10/client-vue` binding package, and ships templates under the
  `nuxt` namespace with Vue SFC components in shadcn-vue format.

Rollout order: **Vite + TanStack (default) → Next.js (same registry, new shell) →
Vue/Nuxt (`nuxt` namespace, shadcn-vue components).** Each step validates that the shared spine stayed
framework-agnostic; if a framework forces a change into `@kon10/client` core, that
is a design smell to fix rather than special-case.

---

## 4. Proposed Layout

```
packages/clients/           client family — grouped like packages/modules/* and packages/plugins/*
                            (add `packages/clients/*` to pnpm-workspace.yaml)
  client/                     @kon10/client — framework-agnostic core: delivery SDK + envelope contract
  client-react/               @kon10/client-react — React hooks: useList / useDoc / useSingle (ships first)
  client-vue/                 @kon10/client-vue — Vue composables (added with the Vue template)
packages/cli/               kon10 typegen  (new, or extend an existing CLI) — framework-agnostic
packages/start/src/api.ts   + GET /api/v1/_manifest
registry/                   type-checked template source, namespaced by framework
  tanstack/                   blog/, docs/, marketing/…   (default, ships first)
  next/                       blog/, …                    (reuses non-route files from tanstack)
  nuxt/                       blog/, …                    (Vue SFC, shadcn-vue format)
apps/registry/              builds + serves registry.json + /r/<framework>/*.json  (or fold into docs)
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

1. **Envelope relocation + `@kon10/client` core.** ✅ **Done.** `apiResponseSchema`
   et al. now live in `@kon10/client` (`@kon10/start/envelope` re-exports them);
   `createDeliveryClient` (framework-agnostic, generic-typed, per-call Zod schemas)
   ships against `/api/v1`, alongside the `@kon10/client-react` hooks package
   (`Kon10Provider` + `useList` / `useDoc` / `useSingle`). Packages live under
   `packages/clients/*`.
2. **`_manifest` endpoint.** ✅ **Done.** `GET /api/v1/_manifest` in
   `packages/start/src/api.ts` serializes each readable entity's `prefix` /
   `slug` / `cardinality` / `kind` / `hierarchical` + non-hidden field configs.
   Gated by the same read authorization as the entity's own reads (entity
   `access` predicate + RBAC guard), so it never advertises an entity the caller
   couldn't fetch; hidden fields omitted; per-identity cached like other reads.
3. **`kon10 typegen`.** ✅ **Done.** New `@kon10/cli` package (`kon10` bin) reads
   the manifest — from a running Studio (`--url`) or a saved file (`--manifest`)
   — and emits per-entity Zod schemas + inferred types plus a delivery-path →
   schema `entities` map. The emitted Zod mirrors core's `buildDocumentSchema`
   field-by-field (per-type data schema, then `.default(v)` / `.nullable().optional()`
   wrapping, `id`/timestamps as strings), with a `z.unknown()` fallback for
   module-registered types. Plug the `entities` map into the client's per-call
   `schema` option.
4. **Registry scaffolding.** ✅ **Done.** New private `@kon10/registry` package:
   a `registry.json` source index + `items/<framework>/…` source tree, and a
   validated build that inlines file contents and emits shadcn
   `registry-item.json` at `public/r/<framework>/<name>.json` plus a discovery
   catalog. Ships the foundational `registry:lib` `kon10-client` item (installs
   `@kon10/client` + a configured client). Hosting is a static `public/` deploy.
   Mirroring `@kon10/ui` primitives as `registry:ui` items is deferred to when a
   template needs specific ones (Phase 5) — until then templates can pull
   primitives from shadcn's own registry via `registryDependencies`.
5. **First template — `tanstack/blog` (default).** ✅ **Done.** A `registry:block`
   for Vite + TanStack Start: a blog index + post pages that read a published
   `posts` collection through the `kon10-client` lib (reused, not duplicated) and
   the per-call Zod schema pattern, with TanStack Router loaders as the data
   shell and plain Tailwind theme-token markup for presentation. Installable via
   `npx shadcn add <host>/r/tanstack/blog.json`. A syntax guard in
   `@kon10/registry` transpile-checks every item source file so templates can't
   ship a parse error. The discovery catalog (Phase 4's `r/index.json`) lists it.

The spine (client → manifest → typegen → registry) and the first end-to-end
template are complete and verified. The remaining roadmap is additive — each
step follows the established pattern:

6. **Second framework — `next/blog`.** Same registry, reusing the TanStack
   template's non-route files; validates the shell/spine split.
7. **Vue/Nuxt track.** `@kon10/client-vue` binding + `nuxt/blog` via the shadcn-vue
   registry namespace.
8. **Template gallery + scaffolder.** `docs`, `marketing`, etc. across frameworks
   (discovery catalog already emitted); a `create-kon10-site` command (or a
   `--template` / `--framework` flag) paralleling `create-kon10-app`.

---

## 7. Open Questions

- **CLI home:** new `packages/cli` vs. extending `create-kon10-app`'s bin.
- **React data layer:** ship our own hooks vs. lean on TanStack Query as a peer.
- **Registry hosting:** standalone `apps/registry` vs. a route in the docs site.
- **Vue registry mechanics:** target shadcn-vue's registry format directly, or
  publish a Kon10-native Vue registry; how much of the JSON pipeline is shared with
  the React namespace.
- **Shared-file reuse across React shells:** how the build expresses "Next reuses
  TanStack's non-route files" without duplicating source (registry composition vs.
  a shared `registry/_shared` tree pulled into both).
- **Versioning:** how a template pins a compatible `@kon10/client` / manifest
  shape as entities evolve (manifest could carry a schema version).
- **Preview/ISR:** whether templates get a draft-preview path (delivery API today
  serves only the entity's `api.where` constraint, e.g. `status: 'published'`).
