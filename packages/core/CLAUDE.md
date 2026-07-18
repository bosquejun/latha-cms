# @kon10/core — The Kernel

Pure, domain-agnostic orchestration layer. Everything else in the monorepo depends inward on this package; it depends on nothing but `zod`.

Read the root [`CLAUDE.md`](../../CLAUDE.md) for the project-wide non-negotiables — this file covers what's specific to core.

## Owns

- **Module + plugin lifecycle** — `bootstrap/` (`defineConfig`, `bootstrapKon10`): topological module resolution, `onInit`/`onReady`, then `migrate`.
- **Module registry** — `registry/` (`ModuleRegistry`): discovers and de-duplicates entities, field types, guards.
- **Hook engine** — `hooks/engine.ts` (`runHooks`, `runHookEvent`): before/after lifecycle transformers.
- **Access evaluator** — `access/evaluator.ts`: evaluates entity access predicates; guards run after.
- **Field type registry** — `fields/` (`registry.ts`, `builtins.ts`, `meta.ts`, `types.ts`): the `registerFieldType({ configSchema, buildDataSchema })` contract and the 9 built-ins (`text`, `number`, `boolean`, `date`, `select`, `richtext`, `relationship`, `group`, `array`).
- **Document schema builder** — `schema/fields.ts` (`buildDocumentSchema`): assembles a Zod schema for a stored document from registered field types.
- **Operations** — `operations/` (exported as `operations` namespace, with `OperationContext`): the entity-agnostic CRUD layer.
- **Provider-agnostic contracts** — `logger/` (`Logger`, `consoleLogger`, `redactLogger`, `silentLogger`), `tracing/` (`Tracer`, `Span`, `noopTracer`, `withSpan`), `telemetry/` (`Telemetry`, `noopTelemetry`), and `errors/` (`ErrorReporter`, `noopErrorReporter`). Each pairs a minimal contract with a no-op default and a `cms.register*` seam; `@kon10/sentry` / `@kon10/telemetry` fill them.
- **Structural type vocabulary** — `types/` (`Entity`, `cardinality`, `hierarchical`, opaque `kind`, `Field`/`FieldTypeMap`, `Kon10Config`/`ResolvedConfig`, hook/guard/access/adapter types).

## Must never contain

- Any specific field type owned by a module (`taxonomy`, `media`, `slug`, `seo`).
- Any entity kind vocabulary (`Collection`/`Document`/`Taxonomy` are `@kon10/content`'s).
- Any Studio/UI layout or display concept, any concrete module, any observability vendor (Sentry, pino).

The test: if you're importing `@kon10/content` (or any module) from here, stop.

## Conventions specific to core

- **Zod-first, always.** Define the `configSchema`, infer the type. Core re-exports `z` (`export { z } from 'zod'`) so every consumer shares one Zod version.
- **Entities are structural.** The kernel branches only on `cardinality` (`'many'` | `'single'`) and `hierarchical` — never on what a module *calls* an entity. `kind?: string` is an opaque passthrough the kernel never reads.
- **No hardcoded field union.** `Field` is built from the registry; there is no `types/field.ts` switch. Add field types via `registerFieldType`, never by editing core.
- **Belongs-in-core test:** would a minimal CMS with only users, no content, no auth, no Studio, need this? If no, it belongs in the relevant module.
- After editing core types, **rebuild before typechecking dependents**: `pnpm --filter @kon10/core build && pnpm -r typecheck`. Dependents typecheck against `dist/`, not source.

## Tests

Colocated `*.test.ts`, run via `node:test` against compiled `dist/`. `pnpm --filter @kon10/core test`.
