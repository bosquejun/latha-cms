# @kon10/registry — shadcn Registry Builder

Build tooling that produces the distributable **shadcn registry-item JSON** for the content-site templates (the blocks a scaffolded app can pull in). Not a runtime package — it emits artifacts.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **Build pipeline** — `build.ts` (`buildItems`, `buildCatalog`, `BuiltItem`): turns source template blocks into registry-item JSON + a catalog/index.
- **Schema** — `schema.ts`: the Zod schema for a registry item / index (validates what gets published).

## Conventions specific to registry

- Zod-first: the registry-item shape is a schema first (`schema.ts`), and built output is validated against it.
- This package builds distributable artifacts — treat its output as a public contract that scaffolded apps consume.
- No CMS runtime logic here; it's a packaging/build concern for templates.

## Tests

`build.test.ts`, `items.test.ts` via `node:test`.
