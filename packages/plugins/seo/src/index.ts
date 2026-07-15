/**
 * @kon10/seo — injectable search & social metadata as a core `Plugin`.
 *
 * ```ts
 * import { seo, seoPlugin } from '@kon10/seo'
 *
 * defineConfig({
 *   // Add SEO to every content page without touching each entity…
 *   plugins: [seoPlugin({ inject: ['pages', 'posts'], titleTemplate: '%s · Acme' })],
 *   modules: [ContentModule({ entities: [Collection({
 *     slug: 'posts',
 *     fields: {
 *       title: text({ required: true }),
 *       excerpt: text(),
 *       // …or opt in explicitly per entity, with custom derivation:
 *       seo: seo({ from: { description: '{excerpt}' } }),
 *     },
 *   })] })],
 * })
 * ```
 *
 * The plugin registers the `seo` field type server-side, injects/derives the
 * metadata block (so a freshly created record already carries a sensible
 * title/description), and ships a Studio renderer via `@kon10/seo/studio`
 * (`Plugin.studio.ui`) that shows the fields alongside live Google-result and
 * social-card previews. Client-side validation falls back to `z.unknown()` by
 * design (same as `media`/`taxonomy`/`slug`); real validation runs on the server.
 */

import type { BaseFieldConfig } from '@kon10/core'

// Augment core's FieldTypeMap so consumers get the seo field type.
declare module '@kon10/core' {
  interface FieldTypeMap {
    seo: BaseFieldConfig & {
      type: 'seo'
      from?: Record<string, string>
      titleTemplate?: string
      social?: boolean
      robots?: boolean
      maxTitleLength?: number
      maxDescriptionLength?: number
    }
  }
}

export { seoPlugin, type SeoPluginOptions } from './plugin.js'
export { seo, type SeoOpts } from './builders.js'
export { seoFieldConfigSchema, seoFieldEntry } from './field.js'
export {
  seoDataSchema,
  type SeoData,
  OG_TYPES,
  TWITTER_CARDS,
  DEFAULT_MAX_TITLE_LENGTH,
  DEFAULT_MAX_DESCRIPTION_LENGTH,
} from './schema.js'
export { templateTokens, resolveTemplate, applyTitleTemplate } from './template.js'
export { inferFrom } from './defaults.js'
export { createSeoHooks, deriveSeo, type SeoHookTarget } from './hooks.js'
