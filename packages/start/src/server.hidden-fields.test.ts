/**
 * The Studio RPC dispatcher must strip `meta.hidden` fields exactly like the
 * public delivery API does (`api.test.ts`) — the browser is the client on
 * both surfaces, and the Studio form's own field filtering only controls
 * rendering, not what's already sitting in the JSON response it received.
 * Regression coverage for the motivating case: `@kon10/users`' `passwordHash`
 * (mirrored here as a local entity, matching `api.test.ts`'s pattern, so this
 * package doesn't need a devDependency on `@kon10/users` for one test).
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import {
  defineConfig,
  relationship,
  stampFields,
  text,
  type DBAdapter,
  type Doc,
  type Entity,
  type Query,
} from '@kon10/core'
import { AuthModule, createSessionToken, resolveAuthOptions } from '@kon10/auth'
import { handleKon10Request } from './server.js'
import { getRuntime } from './runtime.js'

function memoryAdapter(): DBAdapter {
  const tables = new Map<string, Map<string, Doc>>()
  let seq = 0
  const table = (slug: string) => {
    let t = tables.get(slug)
    if (!t) tables.set(slug, (t = new Map()))
    return t
  }
  const matches = (doc: Doc, where?: Record<string, unknown>) =>
    Object.entries(where ?? {}).every(([k, v]) => doc[k] === v)

  return {
    async find(slug: string, query?: Query) {
      return [...table(slug).values()].filter((d) => matches(d, query?.where))
    },
    async findOne(slug: string, id: string) {
      return table(slug).get(id) ?? null
    },
    async count(slug: string, query?: Query) {
      return [...table(slug).values()].filter((d) => matches(d, query?.where)).length
    },
    async create(slug: string, data: Record<string, unknown>) {
      const doc = { id: `r${++seq}`, ...data } as Doc
      table(slug).set(doc.id, doc)
      return doc
    },
    async update(slug: string, id: string, data: Record<string, unknown>) {
      const doc = { ...table(slug).get(id)!, ...data } as Doc
      table(slug).set(id, doc)
      return doc
    },
    async delete(slug: string, id: string) {
      table(slug).delete(id)
    },
    async migrate() {},
  }
}

// Mirrors `@kon10/users`' shape at the `users` slug (the default subject-store
// entity) without depending on that package — same pattern `api.test.ts` uses
// for its own hidden-field coverage.
const usersEntity: Entity = {
  cardinality: 'many',
  slug: 'users',
  actions: ['read', 'create', 'update', 'delete'],
  fields: stampFields({
    email: text({ required: true, unique: true }),
    name: text(),
    roles: relationship({ to: 'roles', many: true }),
    passwordHash: text({ meta: { hidden: true } }),
  }),
}

const config = defineConfig({
  db: memoryAdapter(),
  modules: [
    { name: 'test-users', entities: [usersEntity] },
    AuthModule({ secret: 'test-secret' }),
  ],
})

let cookie: string
let userId: string

before(async () => {
  const kon10 = await getRuntime(config)
  const adminRole = (await kon10.db.find('roles', { where: { name: 'admin' }, limit: 1 }))[0]!
  const user = await kon10.db.create('users', {
    email: 'admin@test.dev',
    passwordHash: 'super-secret-hash',
    roles: [adminRole.id],
  })
  userId = user.id
  const opts = resolveAuthOptions()
  const token = await createSessionToken({ sub: user.id }, opts.secret, opts.sessionTtlSeconds)
  cookie = `${opts.cookieName}=${token}`
})

function rpc(body: Record<string, unknown>) {
  return handleKon10Request(
    config,
    body,
    new Request('http://localhost/__kon10/rpc', { headers: { cookie } }),
  )
}

test('users:list never serializes passwordHash to the Studio client', async () => {
  const docs = (await rpc({ action: 'list', slug: 'users' })) as Doc[]
  assert.ok(docs.length > 0)
  assert.ok(docs.every((d) => !('passwordHash' in d)))
})

test('users:page never serializes passwordHash to the Studio client', async () => {
  const page = (await rpc({ action: 'page', slug: 'users' })) as { docs: Doc[] }
  assert.ok(page.docs.length > 0)
  assert.ok(page.docs.every((d) => !('passwordHash' in d)))
})

test('users:get never serializes passwordHash to the Studio client', async () => {
  const doc = (await rpc({ action: 'get', slug: 'users', id: userId })) as Doc
  assert.ok(doc)
  assert.ok(!('passwordHash' in doc))
})

test('users:update never echoes passwordHash back to the Studio client', async () => {
  const doc = (await rpc({
    action: 'update',
    slug: 'users',
    id: userId,
    data: { name: 'Renamed Admin' },
  })) as Doc
  assert.equal(doc.name, 'Renamed Admin')
  assert.ok(!('passwordHash' in doc))
})
