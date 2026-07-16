# @kon10/cli — Developer CLI (`kon10`)

The `kon10` command (`bin` → `dist/index.js`). Today it provides `kon10 typegen`: generate typed content schemas from a running Studio's delivery **manifest** (`/api/v1/_manifest`).

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **Entry** — `index.ts`: the CLI arg parsing / command dispatch.
- **Manifest fetch** — `manifest.ts`: pulls the delivery manifest (schema endpoint) that `@kon10/start` serves.
- **Codegen** — `typegen.ts` (`generateTypes(manifest, options)`): emits per-entity Zod schemas and an `entities` map as generated TypeScript.
- **Shared lib** — `lib.ts`.

## Conventions specific to cli

- Consumes `@kon10/client` (the envelope/delivery contract) — it reads the public API surface, never server internals.
- Generated output is **Zod-first** (schemas emitted, types inferred) — consistent with the rest of the codebase; consumers get schemas they can validate with, not bare interfaces.
- The manifest is the contract between a deployed Studio and generated types; keep `typegen` in step with the `/_manifest` shape in `@kon10/start`.

## Tests

`typegen.test.ts` via `node:test` against `dist/`.
