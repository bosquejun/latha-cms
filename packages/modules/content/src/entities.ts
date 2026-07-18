/**
 * Entity factories — `Collection()`, `Document()`, `Taxonomy()`.
 *
 * These are thin, typed constructors that stamp the structural `cardinality`
 * the kernel needs — plus the opaque `kind` tag the Studio layer displays —
 * onto a config object. Fields are declared as a record of builder calls (`text()`,
 * `select()`, …); the factory infers the document type from them — which then
 * types the `access` and `hooks` callbacks — and stamps each record key as the
 * field's `name`, producing the `Field[]` the rest of the system consumes.
 *
 * Defaults (e.g. timestamps, taxonomy implicit fields) are applied here so the
 * rest of the system sees a fully-formed entity.
 */

import {
  select,
  stampFields,
  text,
  z,
  type DeliveryCacheOption,
  type Entity,
  type EntityAccess,
  type EntityStudioConfig,
  type EntityHooks,
  type FieldsRecord,
  type InferDoc,
} from '@kon10/core'

export type Collection<TDoc = Record<string, unknown>> = Entity<TDoc> & { cardinality: 'many' }
export type Document<TDoc = Record<string, unknown>> = Entity<TDoc> & { cardinality: 'single' }
/** Hierarchical or flat grouping — `cardinality: 'many'`. */
export type Taxonomy = Entity & { cardinality: 'many' }

export interface CollectionConfig<TDoc = Record<string, unknown>> {
  slug: string
  studio?: EntityStudioConfig
  access?: EntityAccess<TDoc>
  hooks?: EntityHooks<TDoc>
  timestamps?: boolean
  /**
   * Draft/publish workflow. Enabled by default: the collection carries a
   * `status` select (`draft` | `published`, new records start as drafts) and
   * the public delivery API serves only published records — the Studio surface
   * always sees everything. Declare your own `status` field to restyle it
   * (the delivery filter still applies), or pass `false` for collections
   * whose saves should be live immediately.
   */
  drafts?: boolean
  /**
   * Per-entity override of the app-wide delivery-API cache TTL
   * (`DeliveryApiConfig.cache`) — `false` disables read-through caching for
   * this collection's public reads regardless of the app-wide setting; an
   * object overrides just the TTL. Omit to inherit the app-wide default.
   */
  cache?: DeliveryCacheOption
}

/** The implicit publish-workflow field stamped by `Collection()` (unless overridden). */
function statusField() {
  return select({
    options: z.enum(['draft', 'published']),
    defaultValue: 'draft',
    meta: { sidebar: true },
  })
}

/**
 * Merge the drafts `where` constraint and a `cache` override into one
 * `Entity.api` bag, omitting it entirely when neither is set — the same
 * "no key at all when unused" contract `Entity.api` has always had.
 */
function buildApiConfig(opts: {
  where?: Record<string, unknown>
  cache?: DeliveryCacheOption
}): Entity['api'] | undefined {
  if (opts.where === undefined && opts.cache === undefined) return undefined
  return {
    ...(opts.where !== undefined ? { where: opts.where } : {}),
    ...(opts.cache !== undefined ? { cache: opts.cache } : {}),
  }
}

/** Define a Collection — many records, standard CRUD. */
export function Collection<TFields extends FieldsRecord>(
  input: { fields: TFields } & CollectionConfig<InferDoc<TFields>>,
): Collection<InferDoc<TFields>> {
  const { fields, drafts = true, cache, ...rest } = input
  const withStatus: FieldsRecord =
    drafts && !('status' in fields) ? { ...fields, status: statusField() } : fields
  const api = buildApiConfig({ where: drafts ? { status: 'published' } : undefined, cache })
  return {
    kind: 'collection',
    cardinality: 'many',
    timestamps: true,
    actions: ['read', 'create', 'update', 'delete'],
    ...rest,
    ...(api ? { api } : {}),
    studio: { segment: 'content', ...rest.studio },
    fields: stampFields(withStatus),
  }
}

export interface DocumentConfig<TDoc = Record<string, unknown>> {
  slug: string
  studio?: Omit<EntityStudioConfig, 'useAsTitle' | 'defaultColumns'>
  access?: EntityAccess<TDoc>
  hooks?: EntityHooks<TDoc>
  timestamps?: boolean
  /**
   * Per-entity override of the app-wide delivery-API cache TTL. A rarely-written
   * singleton (e.g. site settings) is a good candidate for a long TTL. Omit
   * to inherit the app-wide default; `false` disables caching entirely.
   */
  cache?: DeliveryCacheOption
}

/** Define a Document — a single-instance singleton (no list view). */
export function Document<TFields extends FieldsRecord>(
  input: { fields: TFields } & DocumentConfig<InferDoc<TFields>>,
): Document<InferDoc<TFields>> {
  const { fields, cache, ...rest } = input
  const api = buildApiConfig({ cache })
  return {
    kind: 'document',
    cardinality: 'single',
    timestamps: true,
    actions: ['read', 'update'],
    ...rest,
    ...(api ? { api } : {}),
    studio: { segment: 'documents', ...rest.studio },
    fields: stampFields(fields),
  }
}

export interface TaxonomyInput {
  slug: string
  /** Allow parent/child nesting. Adds a `parent` field. */
  hierarchical?: boolean
  /** Extra fields beyond the implicit `name` / `slug` (and `parent`). */
  fields?: FieldsRecord
  studio?: EntityStudioConfig
  /**
   * Per-entity override of the app-wide delivery-API cache TTL. Terms
   * (categories, tags) are rarely written, so a long TTL is often a good fit.
   * Omit to inherit the app-wide default; `false` disables caching entirely.
   */
  cache?: DeliveryCacheOption
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

  const api = buildApiConfig({ cache: input.cache })
  return {
    kind: 'taxonomy',
    cardinality: 'many',
    slug: input.slug,
    hierarchical: input.hierarchical,
    timestamps: true,
    studio: { segment: 'taxonomy', ...input.studio },
    actions: ['read', 'create', 'update', 'delete'],
    ...(api ? { api } : {}),
    fields: stampFields({ ...implicit, ...(input.fields ?? {}) }),
  }
}
