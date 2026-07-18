/**
 * Shared test fixtures — an in-memory `DBAdapter` and a `users`-shaped entity.
 *
 * The entity is built with core's own field helpers, mirroring what
 * `@kon10/users` contributes, so these tests exercise the real
 * `entitySubjectStore` path without auth taking a dependency on that package
 * (which the module boundary forbids, and which production does not have
 * either).
 *
 * Not a `*.test.ts` file, so the runner never collects it as a suite.
 */

import {
  relationship,
  stampFields,
  text,
  z,
  type DBAdapter,
  type Doc,
  type Module,
  type Query,
} from 'kon10'

/** A minimal in-memory `DBAdapter`: enough for find/count/create/update/delete. */
export function fakeDb(): DBAdapter {
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

/** A `users`-shaped entity module, mirroring what `@kon10/users` contributes. */
export function usersModule(): Module {
  return {
    name: 'users',
    capabilities: ['users'],
    entities: [
      {
        cardinality: 'many',
        slug: 'users',
        fields: stampFields({
          email: text({ required: true, unique: true, schema: z.email() }),
          name: text(),
          roles: relationship({ to: 'roles', many: true }),
          passwordHash: text(),
        }),
      },
    ],
  }
}
