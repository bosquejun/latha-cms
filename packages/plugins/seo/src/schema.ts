/**
 * The SEO data schema — Zod-first, the single source of truth (CLAUDE.md rule)
 * for both the stored-value validation (`buildDataSchema`) and the `SeoData`
 * TypeScript type the hooks and Studio renderer share.
 *
 * Every sub-field is optional: the field itself is never `required` (document
 * validation runs *before* the derivation hooks, exactly like `@kon10/slug`),
 * and metadata is inherently best-effort — an editor may fill only a title.
 * Length limits are treated as *preview* thresholds (surfaced in the Studio
 * as a soft character counter), never as hard validation, matching how real
 * search consoles behave: a slightly-too-long title still ships.
 */

import { z } from 'zod'

/** OpenGraph object types offered in the Studio `og:type` picker. */
export const OG_TYPES = ['website', 'article', 'profile', 'book'] as const
/** Twitter card layouts offered in the Studio `twitter:card` picker. */
export const TWITTER_CARDS = ['summary', 'summary_large_image'] as const

/** Recommended maximums used for the Studio character counters + previews. */
export const DEFAULT_MAX_TITLE_LENGTH = 60
export const DEFAULT_MAX_DESCRIPTION_LENGTH = 160

export const seoDataSchema = z.object({
  /** `<title>` / `og:title` base — falls back to the entity's title field. */
  title: z.string().optional(),
  /** `<meta name="description">` — falls back to an excerpt/summary field. */
  description: z.string().optional(),
  /** Absolute canonical URL for this document. */
  canonical: z.url().optional(),
  /** `<meta name="robots">` noindex directive. */
  noindex: z.boolean().optional(),
  /** `<meta name="robots">` nofollow directive. */
  nofollow: z.boolean().optional(),
  /** OpenGraph title override (defaults to `title` at render time). */
  ogTitle: z.string().optional(),
  /** OpenGraph description override (defaults to `description`). */
  ogDescription: z.string().optional(),
  /** OpenGraph image — a `media` document id, same as the `media` field type. */
  ogImage: z.string().optional(),
  /** OpenGraph object type. */
  ogType: z.enum(OG_TYPES).optional(),
  /** Twitter card layout. */
  twitterCard: z.enum(TWITTER_CARDS).optional(),
  /** Twitter title override (defaults to `ogTitle` → `title`). */
  twitterTitle: z.string().optional(),
  /** Twitter description override (defaults to `ogDescription` → `description`). */
  twitterDescription: z.string().optional(),
})

export type SeoData = z.infer<typeof seoDataSchema>
