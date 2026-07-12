# @kon10/content

Content entity factories, content field types, built-in blocks, and the config-driven content API.

## Install

```bash
pnpm add @kon10/content
```

## When to use this package

Use `@kon10/content` when your Kon10 config needs content entity factories, content field types, built-in blocks, and the config-driven content API.

## Public API

The primary entrypoint is `ContentModule`. See `src/index.ts` for the complete export surface, including types, helpers, and any Studio extension entrypoints.

## Example

```ts
import { Collection, ContentModule, text } from '@kon10/content'

ContentModule({
  entities: [
    Collection({
      slug: 'posts',
      fields: { title: text({ required: true }) },
    }),
  ],
})
```

## Operational notes

- This module owns `Collection`, `Document`, `Taxonomy`, `taxonomy()` fields, and `blocks()` fields.
- Keep module-specific UI behind the `./studio` export when present.
- Prefer typed field builders and module factories over ad-hoc entity objects.

## Related documentation

- [Root README](../../../README.md)
- [Project specification](../../../SPEC.md)
- [Concept docs](../../../docs/concepts/README.md)
