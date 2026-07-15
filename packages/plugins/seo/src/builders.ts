/**
 * The `seo()` field builder. A dedicated field type (not a hand-rolled
 * `group()`) so `@kon10/seo/studio` can register its search/social preview
 * renderer and `seoPlugin` can find the fields to attach derivation hooks to —
 * the same rationale as `@kon10/slug`'s `slug()`.
 */

import type { FieldMeta, PhantomMeta } from '@kon10/core'
import type { SeoData } from './schema.js'

export interface SeoOpts {
  /**
   * Derivation map: SEO sub-field → `{sibling}` template used to backfill it
   * when left blank. Omit to let `seoPlugin` infer it (title ← the entity's
   * title field, description ← an excerpt/summary field).
   */
  from?: Record<string, string>
  /** Site-wide title template applied to a derived title, e.g. `'%s · Acme'`. */
  titleTemplate?: string
  /** Show the OpenGraph / Twitter section. Default true. */
  social?: boolean
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

/** Search & social metadata for a document. Rendered as a previewable section. */
export function seo<const O extends SeoOpts = {}>(opts?: O): SeoBuilt<O> {
  return { ...(opts ?? {}), type: 'seo' } as SeoBuilt<O>
}
