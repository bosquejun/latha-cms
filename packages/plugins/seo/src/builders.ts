/**
 * The `seo()` and `socialGraph()` field builders. Dedicated field types (not
 * hand-rolled `group()`s) so `@kon10/seo/studio` can register their preview
 * renderers and `seoPlugin` can find the fields to attach derivation hooks and
 * cross-links to — the same rationale as `@kon10/slug`'s `slug()`.
 *
 * The two are independent fields precisely so each lands in its own Studio tab
 * (tabs are grouped by top-level field `meta.group`): pair `seo({ meta: {
 * group: 'SEO' } })` with `socialGraph({ meta: { group: 'Social Graph' } })`.
 */

import type { FieldMeta, PhantomMeta } from 'kon10'
import type { SeoData, SocialData } from './schema.js'

export interface SeoOpts {
  /**
   * Derivation map: SEO sub-field → `{sibling}` template used to backfill it
   * when left blank. Omit to let `seoPlugin` infer it (title ← the entity's
   * title field, description ← an excerpt/summary field).
   */
  from?: Record<string, string>
  /** Site-wide title template applied to a derived title, e.g. `'%s · Acme'`. */
  titleTemplate?: string
  /** Show the robots (noindex/nofollow) switches. Default true. */
  robots?: boolean
  /** Soft title-length threshold for the Studio counter/preview. Default 60. */
  maxTitleLength?: number
  /** Soft description-length threshold. Default 160. */
  maxDescriptionLength?: number
  meta?: FieldMeta
  // No `required`: validation runs before the derivation hook (see field.ts).
}

// Optional on the inferred doc type — the whole block may be absent, and every
// sub-field is optional (see schema.ts), so `__present` is always false.
type SeoBuilt<O extends SeoOpts> = O & { type: 'seo' } & PhantomMeta<SeoData, false>

/** Search metadata (title, description, canonical, robots) with a search preview. */
export function seo<const O extends SeoOpts = {}>(opts?: O): SeoBuilt<O> {
  return { ...(opts ?? {}), type: 'seo' } as SeoBuilt<O>
}

export interface SocialGraphOpts {
  /** Soft title-length threshold for the Studio counter/preview. Default 60. */
  maxTitleLength?: number
  meta?: FieldMeta
}

type SocialGraphBuilt<O extends SocialGraphOpts> = O & { type: 'socialGraph' } & PhantomMeta<
    SocialData,
    false
  >

/** Open Graph / Twitter card metadata with a live social-card preview. */
export function socialGraph<const O extends SocialGraphOpts = {}>(opts?: O): SocialGraphBuilt<O> {
  return { ...(opts ?? {}), type: 'socialGraph' } as SocialGraphBuilt<O>
}
