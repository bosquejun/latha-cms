/**
 * Role-resolution caching: `getRolePermissions`/`resolveRoleGrants` read
 * through `kon10.cache` when one is registered, and `rolesEntity`'s
 * afterUpdate/afterDelete hooks invalidate immediately on change.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CacheAdapter, Doc, JsonValue, Kon10Instance, Query } from '@kon10/core'
import { getRolePermissions, resolveRoleGrants } from './resolve.js'
import { rolesEntity } from './entities.js'

function spyCache(): CacheAdapter & { getCalls: number; setCalls: number } {
  const store = new Map<string, JsonValue>()
  return {
    getCalls: 0,
    setCalls: 0,
    async get(key: string) {
      this.getCalls++
      return store.get(key)
    },
    async set(key: string, value: JsonValue) {
      this.setCalls++
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
    async has(key: string) {
      return store.has(key)
    },
  }
}

/** Minimal fake instance: an in-memory `roles` table, no catalog. */
function fakeKon10(cache?: CacheAdapter): Kon10Instance {
  const rows = new Map<string, Doc>()
  let seq = 0
  const db = {
    async find(_slug: string, query?: Query) {
      const all = [...rows.values()]
      const where = query?.where ?? {}
      const matched = all.filter((row) => Object.entries(where).every(([k, v]) => row[k] === v))
      return matched.slice(0, query?.limit ?? matched.length)
    },
    async findOne(_slug: string, id: string) {
      return rows.get(id) ?? null
    },
    async count() {
      return rows.size
    },
    async create(_slug: string, data: Record<string, unknown>) {
      const doc = { id: `r${++seq}`, ...data } as Doc
      rows.set(doc.id, doc)
      return doc
    },
    async update(_slug: string, id: string, data: Record<string, unknown>) {
      const doc = { ...rows.get(id)!, ...data } as Doc
      rows.set(id, doc)
      return doc
    },
    async delete(_slug: string, id: string) {
      rows.delete(id)
    },
    async migrate() {},
  }
  return { db, cache } as unknown as Kon10Instance
}

test('getRolePermissions caches the role-by-name lookup', async () => {
  const cache = spyCache()
  const kon10 = fakeKon10(cache)
  await kon10.db.create('roles', { name: 'public', permissions: [] })

  await getRolePermissions(kon10, 'public')
  assert.equal(cache.setCalls, 1)

  await getRolePermissions(kon10, 'public')
  assert.equal(cache.setCalls, 1, 'second call served from cache')
  assert.equal(cache.getCalls, 2)
})

test('resolveRoleGrants caches each role-by-id lookup', async () => {
  const cache = spyCache()
  const kon10 = fakeKon10(cache)
  const role = await kon10.db.create('roles', { name: 'editor', permissions: [] })

  await resolveRoleGrants(kon10, [role.id])
  assert.equal(cache.setCalls, 1)

  await resolveRoleGrants(kon10, [role.id])
  assert.equal(cache.setCalls, 1, 'second call served from cache')
})

test('renaming a role invalidates both its old name and id cache entries immediately', async () => {
  const cache = spyCache()
  const kon10 = fakeKon10(cache)
  const role = await kon10.db.create('roles', { name: 'editor', permissions: [] })

  await getRolePermissions(kon10, 'editor')
  await resolveRoleGrants(kon10, [role.id])
  assert.equal(cache.setCalls, 2)

  const updated = await kon10.db.update('roles', role.id, { name: 'author' })
  await rolesEntity.hooks!.afterUpdate![0]!({
    data: updated as Record<string, unknown>,
    previousDoc: role as Record<string, unknown>,
    principal: null,
    operation: 'update',
    slug: 'roles',
    cms: kon10,
  })

  // The old name no longer resolves to any role, so nothing gets re-cached under it.
  await getRolePermissions(kon10, 'editor')
  assert.equal(cache.setCalls, 2, 'stale name entry was invalidated, not repopulated')

  // The new name resolves fresh and caches under its own key.
  await getRolePermissions(kon10, 'author')
  assert.equal(cache.setCalls, 3)
})

test('deleting a role invalidates its cached id and name entries immediately', async () => {
  const cache = spyCache()
  const kon10 = fakeKon10(cache)
  const role = await kon10.db.create('roles', { name: 'viewer', permissions: [] })

  const beforeDelete = await resolveRoleGrants(kon10, [role.id])
  assert.deepEqual(beforeDelete.roles, ['viewer'], 'sanity check: the role resolves before deletion')

  await kon10.db.delete('roles', role.id)
  await rolesEntity.hooks!.afterDelete![0]!({
    data: role as Record<string, unknown>,
    principal: null,
    operation: 'delete',
    slug: 'roles',
    cms: kon10,
  })

  const grants = await resolveRoleGrants(kon10, [role.id])
  assert.deepEqual(grants, { roles: [], permissions: [] }, 'deleted role no longer resolves, cache not stale')
})
