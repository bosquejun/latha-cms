/**
 * Operations-pipeline coverage: access predicate → guards → Zod validation →
 * before/after hooks → DB, for CRUD, count, and the singleton upsert. Runs
 * against a hand-built instance with an in-memory adapter — the same seams
 * the runners use.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
// Side-effect import: register the built-in field types, exactly as bootstrap
// does — without it every field validates as z.unknown().
import '../fields/builtins.js'
import * as operations from './index.js'
import { AccessDeniedError } from '../access/evaluator.js'
import { stampFields, text, number } from '../schema/fields.js'
import type { DBAdapter, Doc, Query } from '../types/adapter.js'
import type { Entity } from '../types/entity.js'
import type { Guard } from '../types/guard.js'
import type { LathaInstance } from '../types/config.js'

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
      const rows = [...table(slug).values()].filter((d) => matches(d, query?.where))
      const offset = query?.offset ?? 0
      return rows.slice(offset, query?.limit != null ? offset + query.limit : undefined)
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

function instanceFor(entities: Entity[], guards: Guard[] = []): LathaInstance {
  return {
    db: memoryAdapter(),
    entities,
    guards,
    getEntity: (slug: string) => entities.find((e) => e.slug === slug),
    modules: [],
  } as unknown as LathaInstance
}

const hookLog: string[] = []

const posts: Entity = {
  cardinality: 'many',
  slug: 'posts',
  fields: stampFields({
    title: text({ required: true, minLength: 3 }),
    views: number({ integer: true, defaultValue: 0 }),
  }),
  access: {
    delete: ({ principal }) => principal === 'boss',
  },
  hooks: {
    beforeCreate: [
      ({ data }) => {
        hookLog.push('beforeCreate')
        return { ...(data as Record<string, unknown>), title: `[hooked] ${(data as { title: string }).title}` }
      },
    ],
    afterCreate: [
      ({ data }) => {
        hookLog.push('afterCreate')
        return data
      },
    ],
  },
}

const settings: Entity = {
  cardinality: 'single',
  slug: 'settings',
  fields: stampFields({ siteName: text({ required: true }) }),
}

test('create runs validation, defaults, and hooks in order', async () => {
  const cms = instanceFor([posts, settings])
  hookLog.length = 0
  const doc = await operations.create({ cms }, 'posts', { title: 'Hello' })
  assert.equal(doc.title, '[hooked] Hello')
  assert.equal(doc.views, 0) // defaultValue applied by the document schema
  assert.deepEqual(hookLog, ['beforeCreate', 'afterCreate'])
})

test('create rejects invalid data before any DB write', async () => {
  const cms = instanceFor([posts, settings])
  await assert.rejects(() => operations.create({ cms }, 'posts', { title: 'x' }))
  assert.equal(await cms.db.count('posts'), 0)
})

test('access predicates gate operations per principal', async () => {
  const cms = instanceFor([posts, settings])
  const doc = await operations.create({ cms }, 'posts', { title: 'Keep me' })
  await assert.rejects(
    () => operations.destroy({ cms, principal: 'intern' }, 'posts', doc.id),
    AccessDeniedError,
  )
  await operations.destroy({ cms, principal: 'boss' }, 'posts', doc.id)
  assert.equal(await cms.db.count('posts'), 0)
})

test('guards run after access with the opaque context bag', async () => {
  const seen: unknown[] = []
  const guard: Guard = (ctx) => {
    seen.push(ctx.context.enforce)
    if (ctx.context.enforce === true && ctx.operation === 'read') {
      throw new AccessDeniedError('read', ctx.slug)
    }
  }
  const cms = instanceFor([posts, settings], [guard])
  await operations.find({ cms }, 'posts') // no enforce → guard passes
  await assert.rejects(
    () => operations.find({ cms, context: { enforce: true } }, 'posts'),
    AccessDeniedError,
  )
  assert.deepEqual(seen, [undefined, true])
})

test('update validates partially and threads previousDoc to hooks', async () => {
  let previous: unknown
  const entity: Entity = {
    cardinality: 'many',
    slug: 'notes',
    fields: stampFields({ title: text({ required: true }), body: text() }),
    hooks: {
      beforeUpdate: [
        ({ data, previousDoc }) => {
          previous = previousDoc
          return data
        },
      ],
    },
  }
  const cms = instanceFor([entity])
  const doc = await operations.create({ cms }, 'notes', { title: 'v1', body: 'b' })
  // Partial update: `title` omitted must not fail the required check.
  const updated = await operations.update({ cms }, 'notes', doc.id, { body: 'b2' })
  assert.equal(updated.title, 'v1')
  assert.equal(updated.body, 'b2')
  assert.equal((previous as Doc).body, 'b')
  await assert.rejects(() => operations.update({ cms }, 'notes', 'missing', { body: 'x' }))
})

test('update: an omitted optional field is untouched; an explicit null clears it', async () => {
  const entity: Entity = {
    cardinality: 'many',
    slug: 'notes2',
    fields: stampFields({ title: text({ required: true }), body: text() }),
  }
  const cms = instanceFor([entity])
  const doc = await operations.create({ cms }, 'notes2', { title: 'v1', body: 'b' })

  // Omitting `body` from the payload must not touch its stored value.
  const untouched = await operations.update({ cms }, 'notes2', doc.id, { title: 'v2' })
  assert.equal(untouched.body, 'b')

  // An explicit `null` is the clear sentinel — it survives validation (the
  // registry wraps optional fields in `.nullable()`) and reaches the DB.
  const cleared = await operations.update({ cms }, 'notes2', doc.id, { body: null })
  assert.equal(cleared.body, null)
})

test('count applies the same read authorization as find', async () => {
  const denyRead: Entity = {
    cardinality: 'many',
    slug: 'secrets',
    fields: stampFields({ name: text() }),
    access: { read: () => false },
  }
  const cms = instanceFor([denyRead])
  await assert.rejects(() => operations.count({ cms }, 'secrets'), AccessDeniedError)
})

test('list operations reject singletons and unknown slugs', async () => {
  const cms = instanceFor([posts, settings])
  await assert.rejects(() => operations.find({ cms }, 'settings'), /does not support list/)
  await assert.rejects(() => operations.find({ cms }, 'nope'), /Unknown entity/)
})

test('saveGlobal upserts: create first, update thereafter', async () => {
  const cms = instanceFor([posts, settings])
  assert.equal(await operations.findGlobal({ cms }, 'settings'), null)
  const created = await operations.saveGlobal({ cms }, 'settings', { siteName: 'Latha' })
  assert.equal(created.siteName, 'Latha')
  const updated = await operations.saveGlobal({ cms }, 'settings', { siteName: 'LathaCMS' })
  assert.equal(updated.id, created.id)
  assert.equal(updated.siteName, 'LathaCMS')
  assert.equal(await cms.db.count('settings'), 1)
})
