# Kon10 Concepts

Reference documentation for the vocabulary and architecture of Kon10.
For the project-wide spec and roadmap, see [`../../SPEC.md`](../../SPEC.md).

| Doc | What it covers |
|---|---|
| [**Taxonomy**](./taxonomy.md) | The controlled vocabulary — every named concept in the system and what it means. Start here. |
| [**Entities**](./entities.md) | The content model: `Collection`, `Document`, `Taxonomy` — when to use which, fields, and Studio views. |
| [**RBAC**](./rbac.md) | Authorization: roles, scopes & permissions, the generic guard seam, deny-by-default Studio vs allow-by-default headless. |
| [**Frameworks**](./frameworks.md) | The framework-integration layer (`@kon10/start`): how an app wires Kon10 into TanStack Start, the RPC endpoint, and the typed client. |

> **Three things to know up front**
>
> 1. Everything derives from one `kon10.config.ts`. Schema, API, Studio UI, and
>    auth are all generated from it.
> 2. Everything is a **module**, composed through that config.
> 3. The whole Studio surface is driven by a single **RPC endpoint** — one route,
>    many actions — not a REST API. See [Taxonomy → RPC vs API](./taxonomy.md#rpc-vs-api).
