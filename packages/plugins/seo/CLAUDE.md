# @kon10/seo — SEO Plugin

A cross-cutting **plugin**: an injectable search & social metadata field with backend derivation (title templates, inferred defaults) and a Studio preview.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules and the module-vs-plugin distinction.

## Owns

- **`seoPlugin()`** — `plugin.ts` (`seoPlugin`, `SeoPluginOptions`): registers the SEO field type and wires derivation hooks in `onInit`.
- **Field + builders** — `field.ts`, `builders.ts` (`seo`/`SeoOpts`, `socialGraph`/`SocialGraphOpts`), `schema.ts`.
- **Derivation** — `template.ts` (`templateTokens`, `resolveTemplate`, `applyTitleTemplate`), `defaults.ts` (`inferFrom` — derive metadata from sibling fields), `hooks.ts` (`createSeoHooks`, `deriveSeo`).
- **Studio UI** — `studio/fields/seo-field.tsx`, `studio/fields/social-field.tsx`, `studio/ui.tsx` via the `./studio` barrel — including the metadata/social preview.

## Conventions specific to seo

- Metadata is **derived on the backend** (via hooks) and previewed in Studio — the derivation and the preview must agree.
- Detect targets by field type, not name (same discipline as the slug plugin).
- Owns no entities; it injects a field into entities other modules contributed.

## Tests

`defaults`, `template`, `hooks`, `plugin` via `node:test` against `dist/`.
