/**
 * @kon10/seo — injectable search & social metadata as a core `Plugin`.
 *
 * ```ts
 * import { seo, socialGraph, seoPlugin } from '@kon10/seo'
 *
 * defineConfig({
 *   // Add SEO + Social Graph tabs to every content page without touching each entity…
 *   plugins: [seoPlugin({ inject: ['pages', 'posts'], titleTemplate: '%s · Acme' })],
 *   modules: [ContentModule({ entities: [Collection({
 *     slug: 'posts',
 *     fields: {
 *       title: text({ required: true }),
 *       excerpt: text(),
 *       // …or opt in explicitly, one field per tab:
 *       seo: seo({ meta: { group: 'SEO' }, from: { description: '{excerpt}' } }),
 *       social: socialGraph({ meta: { group: 'Social Graph' } }),
 *     },
 *   })] })],
 * })
 * ```
 *
 * The plugin registers the `seo` (search) and `socialGraph` (Open Graph /
 * Twitter) field types server-side, derives/injects the metadata (so a freshly
 * created record already carries a sensible title/description), and ships a
 * Studio renderer per field via `@kon10/seo/studio` — each rendering as its own
 * tab with live previews. Client-side validation falls back to `z.unknown()` by
 * design (same as `media`/`taxonomy`/`slug`); real validation runs on the server.
 */

import type { BaseFieldConfig } from 'kon10'

// Augment core's FieldTypeMap so consumers get the seo + socialGraph field types.
declare module 'kon10' {
  interface FieldTypeMap {
    seo: BaseFieldConfig & {
      type: 'seo'
      from?: Record<string, string>
      titleTemplate?: string
      robots?: boolean
      maxTitleLength?: number
      maxDescriptionLength?: number
    }
    socialGraph: BaseFieldConfig & {
      type: 'socialGraph'
      seoField?: string
      maxTitleLength?: number
    }
  }
}

export { seoPlugin, type SeoPluginOptions } from './plugin.js'
export { seo, socialGraph, type SeoOpts, type SocialGraphOpts } from './builders.js'
export {
  seoFieldConfigSchema,
  seoFieldEntry,
  socialFieldConfigSchema,
  socialFieldEntry,
} from './field.js'
export {
  seoDataSchema,
  socialDataSchema,
  type SeoData,
  type SocialData,
  OG_TYPES,
  TWITTER_CARDS,
  DEFAULT_MAX_TITLE_LENGTH,
  DEFAULT_MAX_DESCRIPTION_LENGTH,
} from './schema.js'
export { templateTokens, resolveTemplate, applyTitleTemplate } from './template.js'
export { inferFrom } from './defaults.js'
export { createSeoHooks, deriveSeo, type SeoHookTarget } from './hooks.js'
