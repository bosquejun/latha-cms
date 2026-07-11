/**
 * The generic entity shape — the kernel's only structural vocabulary.
 *
 * Every entity is either a singleton (`'single'`, exactly one record, no list
 * view) or a list (`'many'`, standard CRUD), optionally `hierarchical` (a
 * self-referential parent field, for "many" entities that support nesting).
 * That's the entirety of what the kernel needs to know — it has no concept of
 * "Collection", "Document", or "Taxonomy". Those are `@kon10/content`'s
 * vocabulary, layered on top via type aliases and factory functions that
 * produce this shape.
 */

import type { EntityAccess, Operation } from './access.js'
import type { Field } from '../fields/types.js'
import type { EntityHooks } from './hook.js'

export type Cardinality = 'many' | 'single'

/** A per-entity or app-wide delivery-API cache setting: a TTL override, or `false` to disable. */
export type DeliveryCacheOption = { ttlSeconds?: number } | false

export interface EntityStudioConfig {
  /** Field name used as the row/title label in list views. */
  useAsTitle?: string
  /** Default fields shown as columns in the list view. */
  defaultColumns?: string[]
  /** Optional plural/singular label overrides. */
  labels?: { singular?: string; plural?: string }
  /** Hide this entity from the Studio sidebar. */
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
  /**
   * Width of this entity's create/edit form in the Studio: `'full'` spans the
   * content column, `'narrow'` caps it at the reading-width tier. Omit to let
   * the form decide — full when it renders a sidebar, narrow otherwise. Like
   * `segment`, an opaque passthrough the kernel never reads.
   */
  formWidth?: 'full' | 'narrow'
  /**
   * URL segment used to build Studio hrefs for this entity's list/edit views
   * (e.g. `'content'` → `/studio/content/<slug>`, `'taxonomy'` →
   * `/studio/taxonomy/<slug>`, `'documents'` → `/studio/documents/<slug>`).
   * The kernel never reads this — it is an opaque passthrough for the Studio
   * routing layer, the same contract as `kind` and field `meta`.
   */
  segment?: string
}

export interface Entity<TDoc = Record<string, unknown>> {
  slug: string
  /** One record (`'single'`) or many (`'many'`). */
  cardinality: Cardinality
  /** Self-referential parent field, for `'many'` entities that support nesting. */
  hierarchical?: boolean
  fields: Field[]
  studio?: EntityStudioConfig
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
   * Opaque tag a module may attach for its own Studio/routing purposes (e.g.
   * `'collection' | 'document' | 'taxonomy'`). The kernel never reads this —
   * same contract as a field's `meta` bag.
   */
  kind?: string
  /**
   * Public-delivery hint, read by runners the same way `studio` is — the
   * kernel never reads it. `where` holds equality constraints every delivery
   * read of this entity is scoped to (e.g. `{ status: 'published' }` stamped
   * by a content module with drafts enabled).
   */
  api?: {
    where?: Record<string, unknown>
    /**
     * Per-entity override of `DeliveryApiConfig.cache` — `false` disables
     * caching for this entity's delivery-API reads regardless of the
     * app-wide setting; an object overrides just the TTL. Omit to inherit
     * the app-wide default. Same passthrough contract as `where`.
     */
    cache?: DeliveryCacheOption
  }
}

/**
 * An `Entity` with its document shape erased, for contexts that hold many
 * entities of mutually unrelated `TDoc`s side by side — the module registry,
 * `Kon10Instance.entities`, `DBAdapter.migrate()`. `EntityAccess`/`EntityHooks`
 * use `TDoc` in both parameter and return position, so `Entity<TDoc>` is
 * invariant in `TDoc`: there is no subtype relationship between
 * `Entity<Specific>` and `Entity<Record<string, unknown>>` in either
 * direction. TypeScript has no existential-type syntax for "an Entity for
 * some TDoc I don't need to know," so `AnyEntity` names that erasure
 * explicitly rather than leaving bare `any` scattered at every call site.
 * Code that only reads structural fields (`cardinality`, `fields`, `kind`,
 * …) and never calls `access`/`hooks` with a concrete value can keep using
 * plain `Entity` (defaulting `TDoc` to `Record<string, unknown>`).
 */
export type AnyEntity = Entity<any>

/** Narrowing helpers. */
export function isMany(e: Entity): e is Entity & { cardinality: 'many' } {
  return e.cardinality === 'many'
}
export function isSingle(e: Entity): e is Entity & { cardinality: 'single' } {
  return e.cardinality === 'single'
}
