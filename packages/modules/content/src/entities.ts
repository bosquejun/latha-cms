/**
 * Entity factories — `Collection()`, `Document()`, `Taxonomy()`.
 *
 * These are thin, typed constructors that stamp the discriminant `kind` onto a
 * config object so the kernel registry and storage layer can treat entities
 * uniformly. Defaults (e.g. timestamps, taxonomy implicit fields) are applied
 * here so the rest of the system sees a fully-formed entity.
 */

import type {
  Collection,
  CollectionAccess,
  CollectionAdminConfig,
  CollectionHooks,
  Document,
  Field,
  Taxonomy,
} from '@latha/core'

export interface CollectionInput<TDoc = Record<string, unknown>> {
  slug: string
  fields: Field[]
  admin?: CollectionAdminConfig
  access?: CollectionAccess<TDoc>
  hooks?: CollectionHooks<TDoc>
  timestamps?: boolean
}

/** Define a Collection — many records, standard CRUD. */
export function Collection<TDoc = Record<string, unknown>>(
  input: CollectionInput<TDoc>,
): Collection<TDoc> {
  return { kind: 'collection', timestamps: true, ...input }
}

export interface DocumentInput<TDoc = Record<string, unknown>> {
  slug: string
  fields: Field[]
  admin?: Document<TDoc>['admin']
  access?: CollectionAccess<TDoc>
  hooks?: CollectionHooks<TDoc>
  timestamps?: boolean
}

/** Define a Document — a single-instance singleton (no list view). */
export function Document<TDoc = Record<string, unknown>>(
  input: DocumentInput<TDoc>,
): Document<TDoc> {
  return { kind: 'document', timestamps: true, ...input }
}

export interface TaxonomyInput {
  slug: string
  /** Allow parent/child nesting. Adds a `parent` field. */
  hierarchical?: boolean
  /** Extra fields beyond the implicit `name` / `slug` (and `parent`). */
  fields?: Field[]
  admin?: CollectionAdminConfig
}

/**
 * Define a Taxonomy — hierarchical or flat grouping. The implicit `name`,
 * `slug`, and (when hierarchical) `parent` fields are prepended so the
 * taxonomy stores and validates like any other entity.
 */
export function Taxonomy(input: TaxonomyInput): Taxonomy {
  const implicit: Field[] = [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, required: true },
  ]
  if (input.hierarchical) {
    implicit.push({ name: 'parent', type: 'text' })
  }

  return {
    kind: 'taxonomy',
    slug: input.slug,
    hierarchical: input.hierarchical,
    admin: input.admin,
    fields: [...implicit, ...(input.fields ?? [])],
  }
}
