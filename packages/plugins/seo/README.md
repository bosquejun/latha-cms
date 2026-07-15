# @kon10/seo

Injectable search & social metadata for Kon10. It provides an `seo()` field
builder, server-side field registration, backend derivation hooks, and a Studio
renderer with live Google-result and social-card previews.

## Install

```bash
pnpm add @kon10/seo
```

## When to use this package

Use `@kon10/seo` when pages, posts, or any content need editor-friendly search
and social metadata — a meta title/description, canonical URL, robots
directives, OpenGraph, and Twitter cards — without hand-rolling the same field
group on every entity.

## Public API

- `seoPlugin(options)` to register the field type, inject fields, and wire the derivation hooks.
- `seo()` field builder for explicit, per-entity opt-in.
- `@kon10/seo/studio` for the Studio renderer.
- `seoDataSchema` / `SeoData`, plus the template + derivation helpers, for custom workflows.

## Two ways to opt in

Both styles work together — pick per entity.

**Explicit field** — add `seo()` to the entity's fields (full control over
derivation and layout):

```ts
import { defineConfig, text } from '@kon10/core'
import { Collection, ContentModule } from '@kon10/content'
import { seo, seoPlugin } from '@kon10/seo'

export default defineConfig({
  plugins: [seoPlugin({ titleTemplate: '%s · Acme' })],
  modules: [
    ContentModule({
      entities: [
        Collection({
          slug: 'posts',
          fields: {
            title: text({ required: true }),
            excerpt: text(),
            // description auto-derives from `excerpt`; title from `title`.
            seo: seo({ meta: { group: 'SEO & Meta' } }),
          },
        }),
      ],
    }),
  ],
})
```

**Config injection** — add SEO to entities that don't declare a field, by slug
list or predicate:

```ts
seoPlugin({
  inject: ['pages', 'posts'],            // or: (entity) => entity.kind === 'document'
  titleTemplate: '%s · Acme',
})
```

## How it works

- **Field type.** `seo` is a Zod-first field type whose stored value is the
  `SeoData` object (title, description, canonical, noindex/nofollow, OpenGraph,
  Twitter). It is never `required`, so a fresh payload validates before the
  hooks fill it.
- **Backend derivation.** At `onInit` — after every module, before `migrate()`,
  so the storage column is created for free — the plugin resolves each field's
  `from` map (falling back to a value inferred from the entity's own fields:
  title ← the title field, description ← an excerpt/summary field) and appends
  `beforeCreate`/`beforeUpdate` hooks. The hooks **backfill only** blank
  sub-fields, so a newly created record already carries sensible metadata and
  re-saving never clobbers an editor's own text.
- **Studio.** A field renderer (shipped via `Plugin.studio.ui`) composes the
  Studio's existing renderers for each sub-field — so an OG image reuses the
  media picker — and adds live search-result and social-card previews that fall
  back to what the server would derive.

## Options

| Option | Purpose |
|---|---|
| `inject` | Entity slugs (or a predicate) to auto-add an `seo` field to. |
| `titleTemplate` | Site-wide template applied to a *derived* title, e.g. `'%s · Acme'`. |
| `social` / `robots` | Defaults for whether injected fields show those sections. |
| `from` | Plugin-wide derivation map merged under each field's own `from`. |

## Operational notes

- Register `seoPlugin()` once in the Kon10 config.
- Detection is by field *type* `'seo'`, never by name — a hand-rolled
  `seo: group(...)` is left untouched.
- Length limits are preview thresholds, not hard validation: a slightly long
  title still saves.

## Related documentation

- [Root README](../../../README.md)
- [Content concepts](../../../docs/concepts/entities.md)
- [Studio extensions](../../../docs/studio-extensions.md)
