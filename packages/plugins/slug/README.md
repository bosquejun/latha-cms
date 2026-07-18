# @kon10/slug

Template-based slug field plugin for Kon10. It provides a `slug()` field builder, server-side field registration, slug/path normalization, uniqueness hooks, nested path support, and a Studio field renderer.

## Install

```bash
pnpm add @kon10/slug
```

## When to use this package

Use `@kon10/slug` when collections need editor-friendly URL segments or nested paths derived from fields such as `title`, `date`, or parent records.

## Public API

- `slugPlugin()` to register the field type and hooks.
- `slug()` field builder for content models.
- `slugify()`, `slugifyPath()`, and template helpers for custom workflows.
- `@kon10/slug/studio` for the Studio renderer.

## Example

```ts
import { defineConfig, text } from 'kon10'
import { Collection, ContentModule } from '@kon10/content'
import { slug, slugPlugin } from '@kon10/slug'

export default defineConfig({
  plugins: [slugPlugin()],
  modules: [
    ContentModule({
      entities: [
        Collection({
          slug: 'posts',
          fields: {
            title: text({ required: true }),
            slug: slug({ from: '{title}' }),
          },
        }),
      ],
    }),
  ],
})
```

## Operational notes

- Register `slugPlugin()` once in the Kon10 config before using `slug()` fields.
- Server-side validation enforces the path pattern; client-side validation intentionally falls back for plugin field types.
- Use nested slug options when page paths must cascade from parent records.

## Related documentation

- [Root README](../../../README.md)
- [Content concepts](../../../docs/concepts/entities.md)
- [Studio extensions](../../../docs/studio-extensions.md)
