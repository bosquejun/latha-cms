/**
 * `entitySubjectStore` coverage for the first-run setup seam.
 *
 * The store is the pluggable identity source. First-run setup needs two more
 * capabilities from it — counting subjects (to detect an empty install) and
 * creating one (to mint the first admin) — and both are optional, so a custom
 * store backed by an external IdP can decline them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrapKon10, defineConfig, type Kon10Instance } from 'kon10'
import { AuthModule } from './module.js'
import { getSubjectStore } from './subject-store.js'
import { fakeDb, usersModule } from './test-support.js'

function boot(): Promise<Kon10Instance> {
  return bootstrapKon10(
    defineConfig({
      db: fakeDb(),
      modules: [usersModule(), AuthModule({ secret: 'test-secret' })],
    }),
  )
}

test('entitySubjectStore counts subjects in the backing entity', async () => {
  const cms = await boot()
  const store = getSubjectStore(cms)

  assert.equal(await store.count!(), 0)

  await store.create!({ email: 'first@example.com', passwordHash: 'hash', roles: [] })

  assert.equal(await store.count!(), 1)
})

test('entitySubjectStore creates a subject findable by email', async () => {
  const cms = await boot()
  const store = getSubjectStore(cms)

  const created = await store.create!({
    email: 'admin@example.com',
    passwordHash: 'hash',
    name: 'Admin',
    roles: [],
  })

  const found = await store.findByEmail('admin@example.com')
  assert.equal(found?.id, created.id)
  assert.equal(found?.passwordHash, 'hash')
})
