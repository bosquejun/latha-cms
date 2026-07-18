# kon10

Kon10's framework-agnostic kernel. It defines the configuration model, module and plugin contracts, entity/field types, access evaluation, hooks, the module registry, and local CRUD operations.

## Install

```bash
pnpm add kon10 zod
```

> In this monorepo the package is consumed through pnpm workspaces.

## When to use this package

Use `kon10` when you are authoring a Kon10 config, building a first- or third-party module, defining fields, or calling the local operations API from server-side code. The package intentionally has no database, storage, routing, or UI dependency.

## Public API

- `defineConfig()` and `bootstrapKon10()` for composing a Kon10 instance.
- Field builders such as `text()`, `select()`, `relationship()`, `group()`, and `array()`.
- Zod schema helpers such as `buildZodSchema()` and `InferDoc`.
- Module registry, hook engine, access evaluator, and operation context types.
- A shared `z` export so packages use the same Zod instance.

## Example

```ts
import { buildZodSchema, text, type InferDoc } from 'kon10'

const fields = {
  title: text({ required: true }),
  summary: text(),
}

const schema = buildZodSchema(fields)
type Note = InferDoc<typeof fields>
```

Most applications should pair `defineConfig()` with a database adapter from `@kon10/storage` and entity factories from `@kon10/content`; the lower-level exports here are primarily for modules and advanced integrations.

## Design notes

- Keep this package pure and runtime-portable. Do not import framework, database, or React code here.
- Treat Zod field schemas as the runtime source of truth for validation and TypeScript inference.
- Register new field types through the field registry and TypeScript module augmentation.

## Related documentation

- [Root README](../../README.md)
- [Project specification](../../SPEC.md)
- [Entities concept](../../docs/concepts/entities.md)
