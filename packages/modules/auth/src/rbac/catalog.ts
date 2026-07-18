/**
 * Permission catalog — derived from the live config, synced into the DB.
 *
 * The catalog (scopes + permissions) is authoritative *from code*: one scope
 * per entity that declares `entity.actions`, plus the built-in `studio` scope
 * and the superadmin `*`. Entities without `actions` are excluded — each module
 * controls which operations are grantable on its own entities. At boot we
 * upsert into `scopes`/`permissions` and prune stale rows so the Studio UI
 * always shows current permissions. Roles (the grants) remain hand-managed
 * data — only the catalog is synced.
 *
 * The id↔key maps are cached per instance for fast enforcement and seeding.
 */

import type { Doc, Kon10Instance } from '@kon10/core'
import { STUDIO_ACCESS, SUPERADMIN, permissionKey } from './permissions.js'
import { PERMISSIONS_SLUG, SCOPES_SLUG } from './entities.js'

export interface ScopeRecord {
  key: string
  label: string
  module: string
}

export interface PermissionRecord {
  key: string
  label: string
  scope: string
  action: string
  module: string
}

export interface RbacCatalog {
  scopes: ScopeRecord[]
  permissions: PermissionRecord[]
  /** Permission DB id → key, for resolving a role's granted permissions. */
  permissionKeyById: Map<string, string>
  /** Permission key → DB id, for seeding roles from permission keys. */
  permissionIdByKey: Map<string, string>
}

const catalogs = new WeakMap<Kon10Instance, RbacCatalog>()

/** The synced catalog for an instance, if `syncCatalog` has run. */
export function getCatalog(kon10: Kon10Instance): RbacCatalog | undefined {
  return catalogs.get(kon10)
}

function humanize(input: string): string {
  const spaced = input.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Map each entity slug to the name of the module that contributed it. */
function moduleOfEntities(kon10: Kon10Instance): Map<string, string> {
  const out = new Map<string, string>()
  for (const module of kon10.modules) {
    for (const entity of module.entities ?? []) out.set(entity.slug, module.name)
  }
  return out
}

function buildDesired(kon10: Kon10Instance): {
  scopes: ScopeRecord[]
  permissions: PermissionRecord[]
} {
  const moduleOf = moduleOfEntities(kon10)
  const scopes: ScopeRecord[] = []
  const permissions: PermissionRecord[] = []

  for (const entity of kon10.entities) {
    const actions = entity.actions
    if (!actions?.length) continue
    const module = moduleOf.get(entity.slug) ?? ''
    scopes.push({ key: entity.slug, label: humanize(entity.slug), module })
    for (const action of actions) {
      permissions.push({
        key: permissionKey(entity.slug, action),
        label: `${humanize(action)} ${humanize(entity.slug)}`,
        scope: entity.slug,
        action,
        module,
      })
    }
  }

  // Built-in Studio entry gate.
  scopes.push({ key: 'studio', label: 'Studio', module: 'auth' })
  permissions.push({
    key: STUDIO_ACCESS,
    label: 'Access the Studio',
    scope: 'studio',
    action: 'access',
    module: 'auth',
  })

  // Superadmin — matches everything.
  scopes.push({ key: '*', label: 'All resources', module: 'auth' })
  permissions.push({
    key: SUPERADMIN,
    label: 'Full access (superadmin)',
    scope: '*',
    action: '*',
    module: 'auth',
  })

  return { scopes, permissions }
}

/** Upsert `desired` rows (keyed by `key`) into `slug`, pruning stale rows. */
async function syncTable<T extends { key: string }>(
  kon10: Kon10Instance,
  slug: string,
  desired: T[],
): Promise<Doc[]> {
  const existing = await kon10.db.find(slug)
  const byKey = new Map(existing.map((row) => [row.key as string, row]))
  const desiredKeys = new Set(desired.map((d) => d.key))

  for (const row of existing) {
    if (!desiredKeys.has(row.key as string)) await kon10.db.delete(slug, row.id)
  }

  const result: Doc[] = []
  for (const entry of desired) {
    const found = byKey.get(entry.key)
    const data = entry as Record<string, unknown>
    result.push(
      found
        ? await kon10.db.update(slug, found.id, data)
        : await kon10.db.create(slug, data),
    )
  }
  return result
}

/**
 * Sync the catalog into the DB and cache the id↔key maps on the instance.
 * Run from `AuthModule.onReady` (after `migrate`).
 */
export async function syncCatalog(kon10: Kon10Instance): Promise<RbacCatalog> {
  const desired = buildDesired(kon10)

  await syncTable(kon10, SCOPES_SLUG, desired.scopes)
  const permRows = await syncTable(kon10, PERMISSIONS_SLUG, desired.permissions)

  const permissionKeyById = new Map<string, string>()
  const permissionIdByKey = new Map<string, string>()
  for (const row of permRows) {
    const key = row.key as string
    permissionKeyById.set(row.id, key)
    permissionIdByKey.set(key, row.id)
  }

  const catalog: RbacCatalog = {
    scopes: desired.scopes,
    permissions: desired.permissions,
    permissionKeyById,
    permissionIdByKey,
  }
  catalogs.set(kon10, catalog)
  return catalog
}
