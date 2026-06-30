/**
 * The generic entity shape — the kernel's only structural vocabulary.
 *
 * Every entity is either a singleton (`'single'`, exactly one record, no list
 * view) or a list (`'many'`, standard CRUD), optionally `hierarchical` (a
 * self-referential parent field, for "many" entities that support nesting).
 * That's the entirety of what the kernel needs to know — it has no concept of
 * "Collection", "Document", or "Taxonomy". Those are `@latha/content`'s
 * vocabulary, layered on top via type aliases and factory functions that
 * produce this shape.
 */

import type { EntityAccess, Operation } from './access.js'
import type { Field } from '../fields/types.js'
import type { EntityHooks } from './hook.js'

export type Cardinality = 'many' | 'single'

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

export interface Entity<TDoc = Record<string, unknown>> {
  slug: string
  /** One record (`'single'`) or many (`'many'`). */
  cardinality: Cardinality
  /** Self-referential parent field, for `'many'` entities that support nesting. */
  hierarchical?: boolean
  fields: Field[]
  admin?: EntityAdminConfig
  access?: EntityAccess<TDoc>
  hooks?: EntityHooks<TDoc>
  /** Add `createdAt` / `updatedAt` columns. Defaults to `true`. */
  timestamps?: boolean
  /**
   * Operations exposed as grantable RBAC permissions for this entity. Set by
   * the entity factory so the RBAC catalog can read them without knowing the
   * entity's origin. Omit to exclude this entity from the permission catalog.
   */
  actions?: Operation[]
  /**
   * Opaque tag a module may attach for its own admin/routing purposes (e.g.
   * `'collection' | 'document' | 'taxonomy'`). The kernel never reads this —
   * same contract as a field's `meta` bag.
   */
  kind?: string
}

/** Narrowing helpers. */
export function isMany(e: Entity): e is Entity & { cardinality: 'many' } {
  return e.cardinality === 'many'
}
export function isSingle(e: Entity): e is Entity & { cardinality: 'single' } {
  return e.cardinality === 'single'
}
