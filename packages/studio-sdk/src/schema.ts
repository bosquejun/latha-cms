/**
 * Registry-driven Studio description.
 *
 * Pure, serializable helpers that turn the kernel's `Entity[]` (from the module
 * registry) into the shapes the Studio UI consumes: navigation items and
 * per-entity descriptors. No React here, so these can run inside a server
 * function and ship plain JSON to the client.
 */

import type { Entity, Field } from '@kon10/core'

/**
 * Studio-sdk's own vocabulary for entity flavors. Core has no concept of these
 * — it only knows `cardinality`/`hierarchical`. Modules tag their entities
 * with the opaque `entity.kind` string (see `Entity.kind` in `@kon10/core`);
 * `kindOf` below reads that tag, falling back to a cardinality-derived guess
 * for entities that don't set it.
 */
export type EntityKind = 'collection' | 'document' | 'taxonomy'

export interface StudioEntity {
  slug: string
  kind: EntityKind
  label: string
  fields: Field[]
  /** Field used as the row title in list views. */
  useAsTitle?: string
  /** Columns shown by default in the list view. */
  defaultColumns?: string[]
  /** Form width override from the entity config (`studio.formWidth`). */
  formWidth?: 'full' | 'narrow'
}

/** Turn a slug or field name into a human label: `site_name` → `Site name`. */
export function humanize(input: string): string {
  const spaced = input.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function kindOf(entity: Entity): EntityKind {
  if (entity.kind === 'collection' || entity.kind === 'document' || entity.kind === 'taxonomy') {
    return entity.kind
  }
  return entity.cardinality === 'single' ? 'document' : 'collection'
}

function labelOf(entity: Entity): string {
  const labels = entity.studio?.labels
  if (entity.cardinality === 'single') return labels?.singular ?? humanize(entity.slug)
  return labels?.plural ?? humanize(entity.slug)
}

export function describeEntity(entity: Entity): StudioEntity {
  return {
    slug: entity.slug,
    kind: kindOf(entity),
    label: labelOf(entity),
    fields: entity.fields,
    useAsTitle: entity.studio?.useAsTitle,
    defaultColumns: entity.studio?.defaultColumns,
    formWidth: entity.studio?.formWidth,
  }
}

export function describeEntities(entities: Entity[]): StudioEntity[] {
  return entities.map(describeEntity)
}
