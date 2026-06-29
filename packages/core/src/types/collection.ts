/**
 * Generic entity definitions: Collection, Document (singleton), Taxonomy.
 *
 * These are the three structural kinds the kernel understands. The
 * `@latha/content` module exposes the `Collection()` / `Document()` /
 * `Taxonomy()` factory helpers that produce them.
 */

import type { EntityAccess, Operation } from './access.js'
import type { Field } from '../fields/types.js'
import type { EntityHooks } from './hook.js'

export type EntityKind = 'collection' | 'document' | 'taxonomy'

export interface EntityAdminConfig {
  /** Field name used as the row/title label in list views. */
  useAsTitle?: string
  /** Default fields shown as columns in the list view. */
  defaultColumns?: string[]
  /** Optional plural/singular label overrides. */
  labels?: { singular?: string; plural?: string }
  /** Hide this entity from the admin sidebar. */
  hidden?: boolean
  /**
   * Sidebar this entity belongs to: the main nav (default) or the `settings`
   * area, which renders its own sidebar behind the Settings button.
   */
  area?: 'main' | 'settings'
  /**
   * Sidebar section this entity appears under. Overrides the default, which is
   * the contributing module's nav label. Entities sharing a `group` merge into
   * one section.
   */
  group?: string
  /** Sort order within its sidebar section (lower first). Default 0. */
  order?: number
}

/** Many records — standard CRUD list. */
export interface Collection<TDoc = Record<string, unknown>> {
  kind: 'collection'
  slug: string
  fields: Field[]
  admin?: EntityAdminConfig
  access?: EntityAccess<TDoc>
  hooks?: EntityHooks<TDoc>
  /** Add `createdAt` / `updatedAt` columns. Defaults to `true`. */
  timestamps?: boolean
  /**
   * Operations exposed as grantable RBAC permissions for this entity. Set by
   * the entity factory so the RBAC catalog can read them without knowing the
   * entity kind. Omit to exclude this entity from the permission catalog.
   */
  actions?: Operation[]
}

/** Single instance — no list view, exactly one record. */
export interface Document<TDoc = Record<string, unknown>> {
  kind: 'document'
  slug: string
  fields: Field[]
  admin?: Omit<EntityAdminConfig, 'useAsTitle' | 'defaultColumns'>
  access?: EntityAccess<TDoc>
  hooks?: EntityHooks<TDoc>
  timestamps?: boolean
  /** @see Collection.actions */
  actions?: Operation[]
}

/** Hierarchical or flat grouping. */
export interface Taxonomy {
  kind: 'taxonomy'
  slug: string
  /** Allow parent/child nesting. */
  hierarchical?: boolean
  /** Extra fields beyond the implicit `name` / `slug`. */
  fields?: Field[]
  admin?: EntityAdminConfig
  /** @see Collection.actions */
  actions?: Operation[]
  /** Optional per-taxonomy access predicates, evaluated before guard chain. */
  access?: EntityAccess
  /** Optional lifecycle hooks, run around term mutations. */
  hooks?: EntityHooks
}

/**
 * Any entity, doc-type-erased. Concrete collections returned by the factories
 * carry an inferred `TDoc`; this union uses `any` because `TDoc` is invariant
 * in `Collection` — `HookFn<TDoc>` both receives and returns `TDoc`, so no
 * single concrete supertype (`unknown`, `never`, …) lets a specifically-typed
 * `Collection<{ title: string }>` fit `Entity[]`. `any` is the only widening
 * that keeps the assignment.
 */
export type Entity = Collection<any> | Document<any> | Taxonomy

/** Narrowing helpers. */
export function isCollection(e: Entity): e is Collection<any> {
  return e.kind === 'collection'
}
export function isDocument(e: Entity): e is Document<any> {
  return e.kind === 'document'
}
export function isTaxonomy(e: Entity): e is Taxonomy {
  return e.kind === 'taxonomy'
}
