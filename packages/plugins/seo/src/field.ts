/**
 * The `seo` field type — Zod-first config schema + data schema.
 *
 * The stored value is the `SeoData` object (title, description, canonical,
 * robots, OpenGraph, Twitter). The field is deliberately never `required`:
 * document validation runs *before* `beforeCreate` hooks, so a required SEO
 * block would reject the empty payload the derivation hook is about to fill.
 * The hook guarantees a populated block whenever `from` templates resolve.
 *
 * `configSchema` describes what a developer writes (or what `seoPlugin`
 * injects): the `from` derivation map, an optional site-wide `titleTemplate`,
 * and the Studio display toggles (`social`, `robots`, length thresholds).
 */

import { z } from 'zod'
import type { FieldTypeEntry } from '@kon10/core'
import { DEFAULT_MAX_DESCRIPTION_LENGTH, DEFAULT_MAX_TITLE_LENGTH, seoDataSchema } from './schema.js'

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
  /** Show the OpenGraph / Twitter overrides section in the Studio. Default true. */
  social: z.boolean().optional(),
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

export { DEFAULT_MAX_DESCRIPTION_LENGTH, DEFAULT_MAX_TITLE_LENGTH }
