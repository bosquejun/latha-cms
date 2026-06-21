/**
 * Generic, config-driven content server functions.
 *
 * These are the API layer (no REST handlers). A single set of server functions
 * is parameterized by entity `slug`, so every collection / document / taxonomy
 * in the config gets full CRUD without per-collection code. They are thin
 * wrappers over the reusable `@latha/content` API, which itself goes through
 * the `@latha/core` operations pipeline.
 */

import { createServerFn } from '@tanstack/react-start'
import { createContentApi, type JsonDoc } from '@latha/content'
import { getLatha } from '../cms/instance'

// The content API runs as the authenticated user, so per-collection access
// rules (read/create/update/delete) are enforced against the real session.
// `getUser` dynamically imports the server-only session module so the cookie
// helpers never reach the client bundle.
const api = createContentApi({
  getLatha,
  getUser: async () => (await import('../cms/session')).currentAuthUser(),
})

// --- Collections -----------------------------------------------------------

export const listDocs = createServerFn({ method: 'GET' })
  .validator((data: { collection: string }) => data)
  .handler(({ data }): Promise<JsonDoc[]> => api.list(data.collection))

export const getDoc = createServerFn({ method: 'GET' })
  .validator((data: { collection: string; id: string }) => data)
  .handler(({ data }): Promise<JsonDoc | null> =>
    api.findOne(data.collection, data.id),
  )

export const createDoc = createServerFn({ method: 'POST' })
  .validator((data: { collection: string; data: Record<string, unknown> }) => data)
  .handler(({ data }): Promise<JsonDoc> => api.create(data.collection, data.data))

export const updateDoc = createServerFn({ method: 'POST' })
  .validator(
    (data: { collection: string; id: string; data: Record<string, unknown> }) =>
      data,
  )
  .handler(({ data }): Promise<JsonDoc> =>
    api.update(data.collection, data.id, data.data),
  )

export const deleteDoc = createServerFn({ method: 'POST' })
  .validator((data: { collection: string; id: string }) => data)
  .handler(async ({ data }): Promise<{ id: string }> => {
    await api.remove(data.collection, data.id)
    return { id: data.id }
  })

// --- Document singletons ----------------------------------------------------

export const getGlobal = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(({ data: slug }): Promise<JsonDoc | null> => api.getGlobal(slug))

export const saveGlobal = createServerFn({ method: 'POST' })
  .validator((data: { slug: string; data: Record<string, unknown> }) => data)
  .handler(({ data }): Promise<JsonDoc> => api.saveGlobal(data.slug, data.data))

// --- Taxonomies -------------------------------------------------------------

export const listTaxonomyTerms = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(({ data: slug }): Promise<JsonDoc[]> => api.listTerms(slug))

export const createTaxonomyTerm = createServerFn({ method: 'POST' })
  .validator((data: { slug: string; data: Record<string, unknown> }) => data)
  .handler(({ data }): Promise<JsonDoc> => api.createTerm(data.slug, data.data))
