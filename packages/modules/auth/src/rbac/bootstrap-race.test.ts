import assert from 'node:assert/strict'
import test from 'node:test'
import type { DBAdapter, Kon10Instance } from '@kon10/core'
import { fakeDb } from '../test-support.js'
import { syncCatalog } from './catalog.js'
import { seedRoles } from './seed.js'

function instance(db: DBAdapter): Kon10Instance {
  return {
    db,
    entities: [{ slug: 'roles', actions: ['read'] }],
    modules: [{ name: 'auth', entities: [{ slug: 'roles', actions: ['read'] }] }],
  } as unknown as Kon10Instance
}

test('catalog sync recovers when another bootstrap wins a unique-key insert', async () => {
  const db = fakeDb()
  const create = db.create.bind(db)
  let raced = false
  db.create = async (slug, data) => {
    if (slug === 'scopes' && data['key'] === 'roles' && !raced) {
      raced = true
      await create(slug, data)
      throw new Error('duplicate key value violates unique constraint "scopes_key_key"')
    }
    return create(slug, data)
  }

  const catalog = await syncCatalog(instance(db))

  assert.equal(catalog.scopes.filter(({ key }) => key === 'roles').length, 1)
  assert.equal(
    (await db.find('scopes', { where: { key: 'roles' } })).length,
    1,
  )
})

test('role seeding recovers when another bootstrap wins a unique-name insert', async () => {
  const db = fakeDb()
  const kon10 = instance(db)
  await syncCatalog(kon10)

  const create = db.create.bind(db)
  let raced = false
  db.create = async (slug, data) => {
    if (slug === 'roles' && data['name'] === 'admin' && !raced) {
      raced = true
      await create(slug, data)
      throw new Error('duplicate key value violates unique constraint "roles_name_key"')
    }
    return create(slug, data)
  }

  await seedRoles(kon10, [
    { name: 'admin', permissions: ['*'], system: true },
    { name: 'viewer', permissions: [] },
  ])

  assert.equal((await db.find('roles')).length, 2)
})
