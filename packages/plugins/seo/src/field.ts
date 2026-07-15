/**
 * The `seo` and `socialGraph` field types — Zod-first config + data schemas.
 *
 * Two field types (each rendered as its own Studio tab): `seo` owns the search
 * surface, `socialGraph` owns the Open Graph / Twitter surface. Neither is ever
 * `required` — document validation runs *before* `beforeCreate` hooks, so a
 * required block would reject the empty payload the derivation hook is about to
 * fill. The seo hook guarantees a populated block whenever `from` templates
 * resolve; the social block stays empty and falls back to the SEO values at
 * render/delivery time.
 */

import { z } from 'zod'
import type { FieldTypeEntry } from '@kon10/core'
import {
  DEFAULT_MAX_DESCRIPTION_LENGTH,
  DEFAULT_MAX_TITLE_LENGTH,
  seoDataSchema,
  socialDataSchema,
} from './schema.js'

export const seoFieldConfigSchema = z.object({
  type: z.literal('seo'),
  /**
   * Derivation map: SEO sub-field name → a `{sibling}` template used to fill
   * it when the editor leaves it blank (e.g. `{ title: '{title}',
   * description: '{excerpt}' }`). `seoPlugin` stamps a sensible default here at
   * onInit when the field omits it (title ← the entity's title field,
   * description ← an excerpt/summary field), so backend derivation works with
   * zero configuration. Hand-written values win over the default.
   */
  from: z.record(z.string(), z.string()).optional(),
  /**
   * Site-wide title template applied only to a *derived* title (e.g.
   * `'%s · Acme'`). Never applied to a title the editor typed, so it can't
   * double-wrap across updates.
   */
  titleTemplate: z.string().optional(),
  /** Show the noindex / nofollow robots switches in the Studio. Default true. */
  robots: z.boolean().optional(),
  /** Soft character threshold for the title counter/preview. Default 60. */
  maxTitleLength: z.number().int().positive().optional(),
  /** Soft character threshold for the description counter/preview. Default 160. */
  maxDescriptionLength: z.number().int().positive().optional(),
})

export const seoFieldEntry: FieldTypeEntry = {
  configSchema: seoFieldConfigSchema,
  // Length limits are preview-only (see schema.ts) — the stored value is the
  // plain optional object so a long title still validates and persists.
  buildDataSchema: () => seoDataSchema,
}

export const socialFieldConfigSchema = z.object({
  type: z.literal('socialGraph'),
  /**
   * Name of the sibling `seo` field, stamped by `seoPlugin` at onInit so the
   * Studio renderer knows where to read the search title/description that the
   * OG/Twitter previews fall back to. Not hand-written.
   */
  seoField: z.string().optional(),
  /** Soft character threshold for the social title counter/preview. Default 60. */
  maxTitleLength: z.number().int().positive().optional(),
})

export const socialFieldEntry: FieldTypeEntry = {
  configSchema: socialFieldConfigSchema,
  buildDataSchema: () => socialDataSchema,
}

export { DEFAULT_MAX_DESCRIPTION_LENGTH, DEFAULT_MAX_TITLE_LENGTH }
