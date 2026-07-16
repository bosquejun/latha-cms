# @kon10/content — ContentModule

Owns the content-modeling vocabulary and the config-driven content API. This is where `Collection`, `Document`, and `Taxonomy` live — they are **content-module** concepts, not kernel concepts.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **Entity factories** — `entities.ts` (`Collection`, `Document`, `Taxonomy`): type aliases over core's `Entity<TDoc>` narrowed by `cardinality`, each stamping the opaque `kind` tag (`'collection'`/`'document'`/`'taxonomy'`) for Studio/routing to read.
- **`ContentModule`** — `module.ts` (`ContentModule`, `ContentModuleConfig`): registers the `taxonomy` field type in `onInit`; contributes content entities.
- **Field builders** — `builders.ts` (`taxonomy`, `blocks`, `BlockInput`, `BlockDefinition`) and `built-in-blocks.ts`.
- **Taxonomy operations** — `term-tree.ts` (hierarchical term trees) and the `taxonomy` field type (`configSchema` `{ type:'taxonomy', to, many? }`, `buildDataSchema` → string or string[]).
- **Content API** — `api.ts` (`createContentApi`): the config-driven read/write surface over content entities.

## Must never contain

- Auth/session logic, user-entity logic, or media logic. Content depends on core only — never on sibling modules.

## Conventions specific to content

- `Collection`/`Document`/`Taxonomy` are **narrowed aliases**, not new interfaces — a Collection is `cardinality:'many'`, a Document/singleton is `cardinality:'single'`, a Taxonomy is a hierarchical `'many'`. Don't reintroduce parallel interfaces in core.
- Register the `taxonomy` field type in `onInit` via `cms.registerFieldType(...)`; augment `FieldTypeMap` in the `.d.ts` so TS consumers see it.
- Studio UI (the taxonomy field renderer) is contributed through the `./studio` barrel (`studio/index.ts`), referenced by `module.studio.ui` — never imported into `@kon10/studio-sdk` directly.

## Tests

`node:test` against `dist/` (`entities`, `term-tree`). `pnpm --filter @kon10/content test`.
