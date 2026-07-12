import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UsersModule, USERS_SLUG } from './module.js'

test('UsersModule contributes the users collection with safe defaults', () => {
  const module = UsersModule()

  assert.equal(module.name, 'users')
  assert.deepEqual(module.capabilities, ['users'])
  assert.ok(module.entities)
  assert.equal(module.entities.length, 1)

  const entity = module.entities[0]!
  const fields = entity.fields as Array<any>
  const field = (name: string) => fields.find((entry) => entry.name === name)!
  assert.equal(entity.slug, USERS_SLUG)
  assert.equal(entity.cardinality, 'many')
  assert.equal(entity.studio?.area, 'settings')
  assert.equal(entity.studio?.useAsTitle, 'email')
  assert.deepEqual(entity.studio?.defaultColumns, ['email', 'name', 'roles'])
  assert.equal(field('passwordHash').meta?.hidden, true)
})

test('UsersModule merges caller-supplied fields without dropping built-ins', () => {
  const module = UsersModule({
    fields: {
      timezone: { type: 'text', meta: { description: 'Preferred timezone' } },
    },
  })

  assert.ok(module.entities)
  const entity = module.entities[0]!
  const fields = entity.fields as Array<any>
  const field = (name: string) => fields.find((entry) => entry.name === name)!
  assert.ok(field('email'))
  assert.ok(field('roles'))
  assert.equal(field('timezone').type, 'text')
  assert.equal(field('timezone').meta?.description, 'Preferred timezone')
})
