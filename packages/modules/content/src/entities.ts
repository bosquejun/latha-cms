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
  type EntityAccess,
  type EntityAdminConfig,
  type EntityHooks,
  type Document,
  type FieldsRecord,
  type InferDoc,
  type Taxonomy,
} from '@latha/core'

export interface CollectionConfig<TDoc = Record<string, unknown>> {
  slug: string
  admin?: EntityAdminConfig
  access?: EntityAccess<TDoc>
  hooks?: EntityHooks<TDoc>
  timestamps?: boolean
}

/** Define a Collection — many records, standard CRUD. */
export function Collection<TFields extends FieldsRecord>(
  input: { fields: TFields } & CollectionConfig<InferDoc<TFields>>,
): Collection<InferDoc<TFields>> {
  const { fields, ...rest } = input
  return {
    kind: 'collection',
    timestamps: true,
    actions: ['read', 'create', 'update', 'delete'],
    ...rest,
    fields: stampFields(fields),
  }
}

export interface DocumentConfig<TDoc = Record<string, unknown>> {
  slug: string
  admin?: Document<TDoc>['admin']
  access?: EntityAccess<TDoc>
  hooks?: EntityHooks<TDoc>
  timestamps?: boolean
}

/** Define a Document — a single-instance singleton (no list view). */
export function Document<TFields extends FieldsRecord>(
  input: { fields: TFields } & DocumentConfig<InferDoc<TFields>>,
): Document<InferDoc<TFields>> {
  const { fields, ...rest } = input
  return {
    kind: 'document',
    timestamps: true,
    actions: ['read', 'update'],
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
  admin?: EntityAdminConfig
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
    actions: ['read', 'create', 'update', 'delete'],
    fields: stampFields({ ...implicit, ...(input.fields ?? {}) }),
  }
}
