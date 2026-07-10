# Taxonomy — the vocabulary of Kon10

Kon10 uses a small, deliberate set of terms. Naming is consistent across the
codebase: a concept has exactly one name, and that name is used everywhere
(types, functions, files, docs). This page is the glossary.

> The word *taxonomy* is overloaded here on purpose. As a **content** concept,
> `Taxonomy` is an entity kind (categories, tags — see [Entities](./entities.md)).
> As used on *this page*, "taxonomy" means the project's controlled vocabulary —
> the names below.

---

## Content vocabulary

These describe what you model in `kon10.config.ts`. (See also the
[Naming Conventions](../../SPEC.md#naming-conventions) table in the spec.)

| Term | Meaning | Examples |
|---|---|---|
| **Module** | Top-level unit of composition. Everything is a module; modules are wired together in the config. | `ContentModule`, `AuthModule`, `UsersModule` |
| **Entity** | A content type defined inside a module. One of three **kinds**: collection, document, taxonomy. | posts, site-settings, categories |
| **Collection** | An entity kind: *many* records with full CRUD. | posts, pages, products |
| **Document** | An entity kind: a *single* instance (a singleton). No list. | site-settings, nav |
| **Taxonomy** | An entity kind: hierarchical or flat grouping/tagging. | categories, tags |
| **Field** | A unit of a data shape on an entity. | text, richtext, select, relationship |
| **Hook** | A lifecycle callback on an operation. | `beforeCreate`, `afterUpdate` |
| **Access** | A permission function evaluated per operation. | `read`, `create`, `update`, `delete` |
| **Plugin** | A cross-cutting extension that reshapes config/collections. | seo, i18n, draft-preview |

---

## Runtime & framework vocabulary

These describe how the config becomes a running CMS and how an app talks to it.
They live mostly in [`@kon10/core`](../../packages/core) and
[`@kon10/start`](../../packages/start).

| Term | Meaning | Where |
|---|---|---|
| **Config** | The single source of truth. `defineConfig({...})` returns a `ResolvedConfig`. | `@kon10/core` |
| **Instance / Runtime** | The bootstrapped, seeded `Kon10Instance` for a config. Memoized per config, seeded once. | `@kon10/start` `runtime.ts` |
| **RPC** | The transport for the whole Studio surface: one endpoint, dispatched by an `action`. See [RPC vs API](#rpc-vs-api). | `@kon10/start` |
| **RPC action** | One member of the `Kon10RpcInput` union — the "procedure" being called. | `{ action: 'list', collection }` |
| **RPC dispatcher** | The server-only function that runs an action against the instance. | `dispatchKon10Rpc` / `handleKon10Request` (`@kon10/start/server`) |
| **RPC client** | The typed, per-procedure wrapper the Studio UI calls. | `createKon10Client()` → `Kon10Client` |
| **RPC route** | The framework-owned server route that receives RPC requests. Mounted at `DEFAULT_RPC_PATH` (`/__kon10/rpc`). | `@kon10/start` `routes/rpc.ts` |
| **Provider** | React context that hands the client + mount paths to the Studio components. | `Kon10Provider` |
| **Vite plugin** | Injects the framework routes (`/login`, `/studio/$`, `/__kon10/rpc`) and wires the app config in. | `kon10Start()` (`@kon10/start/vite`) |

---

## RPC vs API

The Studio surface is an **RPC** layer, not a REST API — and the names reflect
that.

**What RPC means here.** There is exactly one endpoint. Every request names a
procedure via an `action`, and the client exposes one method per procedure:

```ts
// One request shape, discriminated by `action`:
{ action: 'nav' }
{ action: 'list',   collection: 'posts' }
{ action: 'create', collection: 'posts', data: { … } }

// One typed method per procedure:
client.list('posts')
client.create('posts', data)
```

That is the definition of a Remote Procedure Call: you invoke named functions
over a single transport. It is deliberately **not** REST, where you would have
many resource URLs and HTTP verbs (`GET /posts`, `POST /posts`,
`DELETE /posts/:id`).

**Why not call it "API"?** "API" is the umbrella term for *any* server
interface — every endpoint is an API. It describes the *mechanism*, not the
*style*. "RPC" describes what this specific layer **is**, which is why the whole
vocabulary is RPC-shaped: `Kon10RpcInput`, `dispatchKon10Rpc`, `Kon10Client`,
the `routes/rpc.ts` route.

**A note on the transport.** The RPC endpoint is implemented as a TanStack Start
**server route** (an "API route" in framework terms) — see
[Frameworks](./frameworks.md). So "RPC" is the *style/contract* and "server
route" is the *transport*. Both names are correct at their own layer; they are
not in conflict.
