/**
 * Content entity definitions: Collection, Document (singleton), Taxonomy.
 *
 * These are the three shapes ContentModule manages. They are described here
 * as plain interfaces; the `@latha/content` module exposes the
 * `Collection()` / `Document()` / `Taxonomy()` factory helpers that produce
 * them.
 */

import type { CollectionAccess } from './access.js'
import type { Field } from './field.js'
import type { CollectionHooks } from './hook.js'

export type EntityKind = 'collection' | 'document' | 'taxonomy'

export interface CollectionAdminConfig {
  /** Field name used as the row/title label in list views. */
  useAsTitle?: string
  /** Default fields shown as columns in the list view. */
  defaultColumns?: string[]
  /** Optional plural/singular label overrides. */
  labels?: { singular?: string; plural?: string }
  /** Hide this entity from the admin sidebar. */
  hidden?: boolean
}

/** Many records — standard CRUD list. */
export interface Collection<TDoc = Record<string, unknown>> {
  kind: 'collection'
  slug: string
  fields: Field[]
  admin?: CollectionAdminConfig
  access?: CollectionAccess<TDoc>
  hooks?: CollectionHooks<TDoc>
  /** Add `createdAt` / `updatedAt` columns. Defaults to `true`. */
  timestamps?: boolean
}

/** Single instance — no list view, exactly one record. */
export interface Document<TDoc = Record<string, unknown>> {
  kind: 'document'
  slug: string
  fields: Field[]
  admin?: Omit<CollectionAdminConfig, 'useAsTitle' | 'defaultColumns'>
  access?: CollectionAccess<TDoc>
  hooks?: CollectionHooks<TDoc>
  timestamps?: boolean
}

/** Hierarchical or flat grouping. */
export interface Taxonomy {
  kind: 'taxonomy'
  slug: string
  /** Allow parent/child nesting. */
  hierarchical?: boolean
  /** Extra fields beyond the implicit `name` / `slug`. */
  fields?: Field[]
  admin?: CollectionAdminConfig
}

export type Entity = Collection | Document | Taxonomy

/** Narrowing helpers. */
export function isCollection(e: Entity): e is Collection {
  return e.kind === 'collection'
}
export function isDocument(e: Entity): e is Document {
  return e.kind === 'document'
}
export function isTaxonomy(e: Entity): e is Taxonomy {
  return e.kind === 'taxonomy'
}
