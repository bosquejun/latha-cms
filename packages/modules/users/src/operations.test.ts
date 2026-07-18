import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'kon10'
import type { Doc, Kon10Instance, Query } from 'kon10'
import { createUser, countUsers, listUsers } from './operations.js'
import { USERS_SLUG, UsersModule } from './module.js'

function memoryKon10(): Kon10Instance {
  const rows = new Map<string, Doc>()
  let seq = 0
  const matches = (doc: Doc, where?: Record<string, unknown>) =>
    Object.entries(where ?? {}).every(([key, value]) => doc[key] === value)

  const [usersEntity] = UsersModule().entities!

  return {
    db: {
      async find(slug: string, query?: Query) {
        assert.equal(slug, USERS_SLUG)
        return [...rows.values()].filter((doc) => matches(doc, query?.where))
      },
      async findOne(_slug: string, id: string) {
        return rows.get(id) ?? null
      },
      async count(slug: string) {
        assert.equal(slug, USERS_SLUG)
        return rows.size
      },
      async create(slug: string, data: Record<string, unknown>) {
        assert.equal(slug, USERS_SLUG)
        const doc = { id: `u${++seq}`, ...data } as Doc
        rows.set(doc.id, doc)
        return doc
      },
      async update(_slug: string, id: string, data: Record<string, unknown>) {
        const doc = { ...rows.get(id), ...data, id } as Doc
        rows.set(id, doc)
        return doc
      },
      async delete(_slug: string, id: string) {
        rows.delete(id)
      },
      async migrate() {},
    },
    entities: [usersEntity],
    guards: [],
    modules: [],
    getEntity(slug: string) {
      return slug === USERS_SLUG ? usersEntity : undefined
    },
  } as unknown as Kon10Instance
}

test('createUser persists through system context and countUsers reads the users collection', async () => {
  const kon10 = memoryKon10()

  const user = await createUser(kon10, {
    email: 'admin@example.com',
    name: 'Admin',
    passwordHash: 'hashed-secret',
    roles: ['owner'],
  })

  assert.equal(user.id, 'u1')
  assert.equal(user.email, 'admin@example.com')
  assert.equal(await countUsers(kon10), 1)
})

test('listUsers strips passwordHash from returned documents', async () => {
  const kon10 = memoryKon10()
  await createUser(kon10, {
    email: 'editor@example.com',
    passwordHash: 'hashed-secret',
  })

  const [user] = await listUsers(kon10)
  assert.ok(user)
  assert.equal(user.email, 'editor@example.com')
  assert.equal('passwordHash' in user, false)
})
