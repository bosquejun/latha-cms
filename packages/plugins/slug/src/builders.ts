/**
 * The `slug()` field builder. A dedicated field type (not `text()` with a
 * hook) so `@latha/slug/admin` can register its live-preview renderer and
 * `slugPlugin` can find the fields to attach generation hooks to.
 */

import type { FieldMeta, PhantomMeta } from '@latha/core'

interface SlugOpts {
  /**
   * Generation template — sibling field tokens, optional date formats, and
   * related-entity traversals: `'title'`, `'{publishedAt:yyyy}/{title}'`,
   * `'{category.slug}/{title}'`.
   */
  from: string
  maxLength?: number
  /** Defaults to true — slugs are unique per entity unless opted out. */
  unique?: boolean
  meta?: FieldMeta
  // No `required`: validation runs before the generation hook (see field.ts).
}

// Optional on the inferred doc type — absent when the template resolves empty.
type SlugBuilt<O extends SlugOpts> = O & { type: 'slug'; unique: boolean } & PhantomMeta<
    string,
    false
  >

/** URL slug generated from a template over sibling fields. Unique by default. */
export function slug<const O extends SlugOpts>(opts: O): SlugBuilt<O> {
  return { unique: true, ...opts, type: 'slug' } as SlugBuilt<O>
}
