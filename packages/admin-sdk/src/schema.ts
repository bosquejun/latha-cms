/**
 * Registry-driven admin description.
 *
 * Pure, serializable helpers that turn the kernel's `Entity[]` (from the module
 * registry) into the shapes the admin UI consumes: navigation items and
 * per-entity descriptors. No React here, so these can run inside a server
 * function and ship plain JSON to the client.
 */

import type { Entity, Field } from '@latha/core'

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

function fieldsOf(entity: Entity): Field[] {
  if (entity.kind === 'taxonomy') return entity.fields ?? []
  return entity.fields
}

function labelOf(entity: Entity): string {
  const labels = entity.admin?.labels
  if (entity.kind === 'document') return labels?.singular ?? humanize(entity.slug)
  return labels?.plural ?? humanize(entity.slug)
}

export function describeEntity(entity: Entity): AdminEntity {
  const base: AdminEntity = {
    slug: entity.slug,
    kind: entity.kind,
    label: labelOf(entity),
    fields: fieldsOf(entity),
  }
  if (entity.kind === 'collection') {
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
    .map((entity) => ({
      slug: entity.slug,
      kind: entity.kind,
      label: labelOf(entity),
      href: hrefFor(entity, basePath),
    }))
}
