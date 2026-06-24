/**
 * Permission catalog — derived from the live config, synced into the DB.
 *
 * The catalog (scopes + permissions) is authoritative *from code*: one scope
 * per entity (so every content collection gets granular create/read/update/
 * delete), plus the built-in `admin` scope and the superadmin `*`. At boot we
 * upsert it into the `scopes`/`permissions` tables and prune anything stale, so
 * the admin UI can browse and assign real, current permissions. Roles (the
 * grants) remain hand-managed data — only the catalog is synced.
 *
 * The id↔key maps are cached per instance for fast enforcement and seeding.
 */

import type { Doc, LathaInstance } from '@latha/core'
import {
  ADMIN_ACCESS,
  SUPERADMIN,
  actionsForKind,
  permissionKey,
} from './permissions.js'
import { PERMISSIONS_SLUG, SCOPES_SLUG } from './entities.js'

/** Catalog entities that are read-only (synced from config) — `read` only. */
const READONLY_SCOPES = new Set<string>([SCOPES_SLUG, PERMISSIONS_SLUG])

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

const catalogs = new WeakMap<LathaInstance, RbacCatalog>()

/** The synced catalog for an instance, if `syncCatalog` has run. */
export function getCatalog(latha: LathaInstance): RbacCatalog | undefined {
  return catalogs.get(latha)
}

function humanize(input: string): string {
  const spaced = input.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Map each entity slug to the name of the module that contributed it. */
function moduleOfEntities(latha: LathaInstance): Map<string, string> {
  const out = new Map<string, string>()
  for (const module of latha.modules) {
    for (const entity of module.entities ?? []) out.set(entity.slug, module.name)
  }
  return out
}

/** Compute the desired catalog from the live entity set. */
function buildDesired(latha: LathaInstance): {
  scopes: ScopeRecord[]
  permissions: PermissionRecord[]
} {
  const moduleOf = moduleOfEntities(latha)
  const scopes: ScopeRecord[] = []
  const permissions: PermissionRecord[] = []

  for (const entity of latha.entities) {
    const module = moduleOf.get(entity.slug) ?? ''
    scopes.push({ key: entity.slug, label: humanize(entity.slug), module })
    // The RBAC catalog entities (scopes/permissions) are synced from config, not
    // user-managed — only `read` is meaningful, so don't emit write permissions
    // that could never do anything.
    const actions = READONLY_SCOPES.has(entity.slug)
      ? (['read'] as const)
      : actionsForKind(entity.kind)
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

  // Built-in admin entry gate.
  scopes.push({ key: 'admin', label: 'Admin', module: 'auth' })
  permissions.push({
    key: ADMIN_ACCESS,
    label: 'Access the admin UI',
    scope: 'admin',
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
  latha: LathaInstance,
  slug: string,
  desired: T[],
): Promise<Doc[]> {
  const existing = await latha.db.find(slug)
  const byKey = new Map(existing.map((row) => [row.key as string, row]))
  const desiredKeys = new Set(desired.map((d) => d.key))

  // Prune rows no longer in the catalog.
  for (const row of existing) {
    if (!desiredKeys.has(row.key as string)) await latha.db.delete(slug, row.id)
  }

  // Upsert each desired row.
  const result: Doc[] = []
  for (const entry of desired) {
    const found = byKey.get(entry.key)
    const data = entry as Record<string, unknown>
    result.push(
      found
        ? await latha.db.update(slug, found.id, data)
        : await latha.db.create(slug, data),
    )
  }
  return result
}

/**
 * Sync the catalog into the DB and cache the id↔key maps on the instance.
 * Run from `AuthModule.onReady` (after `migrate`).
 */
export async function syncCatalog(latha: LathaInstance): Promise<RbacCatalog> {
  const desired = buildDesired(latha)

  await syncTable(latha, SCOPES_SLUG, desired.scopes)
  const permRows = await syncTable(latha, PERMISSIONS_SLUG, desired.permissions)

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
  catalogs.set(latha, catalog)
  return catalog
}
