/**
 * The `slug()` field builder. A dedicated field type (not `text()` with a
 * hook) so `@kon10/slug/studio` can register its live-preview renderer and
 * `slugPlugin` can find the fields to attach generation hooks to.
 */

import type { FieldMeta, PhantomMeta } from '@kon10/core'

interface SlugNestedOpts {
  /**
   * Sibling relationship field naming this document's parent — must point
   * back at the same entity (`relationship({ to: '<this entity>' })`).
   */
  parent: string
  /**
   * Name of the derived full-path field the plugin injects and maintains
   * (`ancestors.../own-segment`). Default `'path'`.
   */
  pathField?: string
}

interface SlugOpts {
  /**
   * Generation template — sibling field tokens, optional date formats, and
   * related-entity traversals: `'title'`, `'{publishedAt:yyyy}/{title}'`,
   * `'{category.slug}/{title}'`.
   */
  from: string
  maxLength?: number
  /**
   * Defaults to true — slugs are unique per entity unless opted out. Not
   * allowed with `nested`: a nested slug stores only its own URL segment,
   * unique among siblings; global uniqueness lives on the injected path field.
   */
  unique?: boolean
  /**
   * Nested-page mode: store only this document's own segment and maintain a
   * full URL path prefixed by the selected parent page's path.
   */
  nested?: SlugNestedOpts
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
  return { unique: !opts.nested, ...opts, type: 'slug' } as SlugBuilt<O>
}
