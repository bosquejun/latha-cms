# @kon10/seo

Injectable search & social metadata for Kon10. It provides `seo()` and
`socialGraph()` field builders, server-side field registration, backend
derivation hooks, and Studio renderers with live Google-result and social-card
previews — each rendered as its own tab.

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

- `seoPlugin(options)` to register the field types, inject fields, and wire the derivation hooks.
- `seo()` (search) and `socialGraph()` (Open Graph / Twitter) field builders for explicit, per-entity opt-in.
- `@kon10/seo/studio` for the Studio renderers.
- `seoDataSchema` / `socialDataSchema` and their types, plus the template + derivation helpers, for custom workflows.

## Two surfaces, two tabs

The search surface (`seo`) and the social surface (`socialGraph`) are separate
fields so each renders in its own Studio tab (tabs are grouped by field
`meta.group`). They stay linked: the social previews fall back to the search
title/description, and `seoPlugin` injects/wires both together.

## Two ways to opt in

Both styles work together — pick per entity.

**Explicit fields** — add `seo()` and `socialGraph()` to the entity's fields,
one per tab:

```ts
import { defineConfig, text } from '@kon10/core'
import { Collection, ContentModule } from '@kon10/content'
import { seo, socialGraph, seoPlugin } from '@kon10/seo'

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
            seo: seo({ meta: { group: 'SEO' } }),
            social: socialGraph({ meta: { group: 'Social Graph' } }),
          },
        }),
      ],
    }),
  ],
})
```

**Config injection** — add both fields to entities that don't declare them, by
slug list or predicate:

```ts
seoPlugin({
  inject: ['pages', 'posts'],            // or: (entity) => entity.kind === 'document'
  titleTemplate: '%s · Acme',
  // social: false,                      // inject the SEO field only
})
```

## How it works

- **Field types.** `seo` (search: title, description, canonical, robots) and
  `socialGraph` (Open Graph + Twitter) are Zod-first field types, each storing
  its own object in its own column. Neither is ever `required`, so a fresh
  payload validates before the hooks fill it.
- **Backend derivation.** At `onInit` — after every module, before `migrate()`,
  so the storage columns are created for free — the plugin resolves each `seo`
  field's `from` map (falling back to a value inferred from the entity's own
  fields: title ← the title field, description ← an excerpt/summary field) and
  appends `beforeCreate`/`beforeUpdate` hooks. The hooks **backfill only** blank
  sub-fields, so a newly created record already carries sensible metadata and
  re-saving never clobbers an editor's own text. The social block stays empty
  and falls back to the SEO values at render time.
- **Studio.** A renderer per field (shipped via `Plugin.studio.ui`) composes the
  Studio's existing renderers for each sub-field — so an OG image reuses the
  media picker — and adds live search-result and social-card previews. The
  `socialGraph` renderer reads its cross-linked `seo` sibling so its previews
  fall back to the search copy.

## Options

| Option | Purpose |
|---|---|
| `inject` | Entity slugs (or a predicate) to auto-add the `seo` + `socialGraph` fields to. |
| `titleTemplate` | Site-wide template applied to a *derived* title, e.g. `'%s · Acme'`. |
| `social` | Inject the `socialGraph` field alongside `seo`. Default `true`. |
| `robots` | Default for whether injected `seo` fields show the robots switches. |
| `from` | Plugin-wide derivation map merged under each `seo` field's own `from`. |

## Operational notes

- Register `seoPlugin()` once in the Kon10 config.
- Detection is by field *type* (`'seo'` / `'socialGraph'`), never by name — a
  hand-rolled `seo: group(...)` is left untouched.
- Length limits are preview thresholds, not hard validation: a slightly long
  title still saves.

## Related documentation

- [Root README](../../../README.md)
- [Content concepts](../../../docs/concepts/entities.md)
- [Studio extensions](../../../docs/studio-extensions.md)
