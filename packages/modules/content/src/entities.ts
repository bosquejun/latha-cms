/**
 * Entity factories — `Collection()`, `Document()`, `Taxonomy()`.
 *
 * These are thin, typed constructors that stamp the discriminant `kind` onto a
 * config object so the kernel registry and storage layer can treat entities
 * uniformly. Fields are declared as a record of builder calls (`text()`,
 * `select()`, …); the factory infers the document type from them — which then
 * types the `access` and `hooks` callbacks — and stamps each record key as the
 * field's `name`, producing the `Field[]` the rest of the system consumes.
 *
 * Defaults (e.g. timestamps, taxonomy implicit fields) are applied here so the
 * rest of the system sees a fully-formed entity.
 */

import {
  stampFields,
  text,
  type Collection,
  type CollectionAccess,
  type CollectionAdminConfig,
  type CollectionHooks,
  type Document,
  type FieldsRecord,
  type InferDoc,
  type Taxonomy,
} from '@latha/core'

export interface CollectionInput<
  TFields extends FieldsRecord,
  TDoc = InferDoc<TFields>,
> {
  slug: string
  fields: TFields
  admin?: CollectionAdminConfig
  access?: CollectionAccess<TDoc>
  hooks?: CollectionHooks<TDoc>
  timestamps?: boolean
}

/** Define a Collection — many records, standard CRUD. */
export function Collection<TFields extends FieldsRecord>(
  input: CollectionInput<TFields>,
): Collection<InferDoc<TFields>> {
  const { fields, ...rest } = input
  return {
    kind: 'collection',
    timestamps: true,
    ...rest,
    fields: stampFields(fields),
  }
}

export interface DocumentInput<
  TFields extends FieldsRecord,
  TDoc = InferDoc<TFields>,
> {
  slug: string
  fields: TFields
  admin?: Document<TDoc>['admin']
  access?: CollectionAccess<TDoc>
  hooks?: CollectionHooks<TDoc>
  timestamps?: boolean
}

/** Define a Document — a single-instance singleton (no list view). */
export function Document<TFields extends FieldsRecord>(
  input: DocumentInput<TFields>,
): Document<InferDoc<TFields>> {
  const { fields, ...rest } = input
  return {
    kind: 'document',
    timestamps: true,
    ...rest,
    fields: stampFields(fields),
  }
}

export interface TaxonomyInput {
  slug: string
  /** Allow parent/child nesting. Adds a `parent` field. */
  hierarchical?: boolean
  /** Extra fields beyond the implicit `name` / `slug` (and `parent`). */
  fields?: FieldsRecord
  admin?: CollectionAdminConfig
}

/**
 * Define a Taxonomy — hierarchical or flat grouping. The implicit `name`,
 * `slug`, and (when hierarchical) `parent` fields are prepended so the
 * taxonomy stores and validates like any other entity.
 */
export function Taxonomy(input: TaxonomyInput): Taxonomy {
  const implicit: FieldsRecord = {
    name: text({ required: true }),
    slug: text({ unique: true, required: true }),
  }
  if (input.hierarchical) {
    implicit.parent = text()
  }

  return {
    kind: 'taxonomy',
    slug: input.slug,
    hierarchical: input.hierarchical,
    admin: input.admin,
    fields: stampFields({ ...implicit, ...(input.fields ?? {}) }),
  }
}
