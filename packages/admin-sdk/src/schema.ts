/**
 * Registry-driven admin description.
 *
 * Pure, serializable helpers that turn the kernel's `Entity[]` (from the module
 * registry) into the shapes the admin UI consumes: navigation items and
 * per-entity descriptors. No React here, so these can run inside a server
 * function and ship plain JSON to the client.
 */

import type { Entity, Field } from '@latha/core'

/**
 * Admin-sdk's own vocabulary for entity flavors. Core has no concept of these
 * — it only knows `cardinality`/`hierarchical`. Modules tag their entities
 * with the opaque `entity.kind` string (see `Entity.kind` in `@latha/core`);
 * `kindOf` below reads that tag, falling back to a cardinality-derived guess
 * for entities that don't set it.
 */
export type EntityKind = 'collection' | 'document' | 'taxonomy'

export interface AdminEntity {
  slug: string
  kind: EntityKind
  label: string
  fields: Field[]
  /** Field used as the row title in list views. */
  useAsTitle?: string
  /** Columns shown by default in the list view. */
  defaultColumns?: string[]
}

export interface AdminNavItem {
  slug: string
  kind: EntityKind
  label: string
  href: string
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
  const labels = entity.admin?.labels
  if (kindOf(entity) === 'document') return labels?.singular ?? humanize(entity.slug)
  return labels?.plural ?? humanize(entity.slug)
}

export function describeEntity(entity: Entity): AdminEntity {
  const kind = kindOf(entity)
  const base: AdminEntity = {
    slug: entity.slug,
    kind,
    label: labelOf(entity),
    fields: entity.fields,
  }
  if (kind === 'collection') {
    base.useAsTitle = entity.admin?.useAsTitle
    base.defaultColumns = entity.admin?.defaultColumns
  }
  return base
}

export function describeEntities(entities: Entity[]): AdminEntity[] {
  return entities.map(describeEntity)
}

const SEGMENT: Record<EntityKind, string> = {
  collection: 'content',
  document: 'documents',
  taxonomy: 'taxonomy',
}

export function hrefFor(
  entity: Pick<AdminEntity, 'slug' | 'kind'>,
  basePath = '/admin',
): string {
  return `${basePath}/${SEGMENT[entity.kind]}/${entity.slug}`
}

/** Build sidebar nav items from the registry's entities. */
export function buildNav(
  entities: Entity[],
  basePath = '/admin',
): AdminNavItem[] {
  return entities
    .filter((e) => !e.admin?.hidden)
    .map((entity) => {
      const kind = kindOf(entity)
      return {
        slug: entity.slug,
        kind,
        label: labelOf(entity),
        href: hrefFor({ slug: entity.slug, kind }, basePath),
      }
    })
}
