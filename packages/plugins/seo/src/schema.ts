/**
 * The SEO + Social data schemas — Zod-first, the single source of truth
 * (CLAUDE.md rule) for both stored-value validation and the TypeScript types
 * the hooks and Studio renderers share.
 *
 * Split into two objects so each backs its own field (and its own Studio tab):
 * `seoDataSchema` is the search surface (title, description, canonical,
 * robots); `socialDataSchema` is the Open Graph / Twitter surface. Both fields
 * are always optional — validation runs *before* the derivation hooks (exactly
 * like `@kon10/slug`), and metadata is inherently best-effort. Length limits
 * are treated as *preview* thresholds (a soft Studio counter), never hard
 * validation, matching how real search consoles behave.
 */

import { z } from 'zod'

/** OpenGraph object types offered in the Studio `og:type` picker. */
export const OG_TYPES = ['website', 'article', 'profile', 'book'] as const
/** Twitter card layouts offered in the Studio `twitter:card` picker. */
export const TWITTER_CARDS = ['summary', 'summary_large_image'] as const

/** Recommended maximums used for the Studio character counters + previews. */
export const DEFAULT_MAX_TITLE_LENGTH = 60
export const DEFAULT_MAX_DESCRIPTION_LENGTH = 160

/** Search-engine surface — the `seo` field / "SEO" tab. */
export const seoDataSchema = z.object({
  /** `<title>` base — falls back to the entity's title field. */
  title: z.string().optional(),
  /** `<meta name="description">` — falls back to an excerpt/summary field. */
  description: z.string().optional(),
  /** Absolute canonical URL for this document. */
  canonical: z.url().optional(),
  /** `<meta name="robots">` noindex directive. */
  noindex: z.boolean().optional(),
  /** `<meta name="robots">` nofollow directive. */
  nofollow: z.boolean().optional(),
})

export type SeoData = z.infer<typeof seoDataSchema>

/** Open Graph / Twitter surface — the `socialGraph` field / "Social Graph" tab. */
export const socialDataSchema = z.object({
  /** OpenGraph title override (defaults to the SEO title at render time). */
  ogTitle: z.string().optional(),
  /** OpenGraph description override (defaults to the SEO description). */
  ogDescription: z.string().optional(),
  /** OpenGraph image — a `media` document id, same as the `media` field type. */
  ogImage: z.string().optional(),
  /** OpenGraph object type. */
  ogType: z.enum(OG_TYPES).optional(),
  /** Twitter card layout. */
  twitterCard: z.enum(TWITTER_CARDS).optional(),
  /** Twitter title override (defaults to `ogTitle` → SEO title). */
  twitterTitle: z.string().optional(),
  /** Twitter description override (defaults to `ogDescription` → SEO description). */
  twitterDescription: z.string().optional(),
})

export type SocialData = z.infer<typeof socialDataSchema>
