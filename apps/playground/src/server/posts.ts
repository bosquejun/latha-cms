/**
 * Server functions for the `posts` collection.
 *
 * These are thin wrappers over the `@latha/core` local API. The same
 * operations power the (future) admin UI and any public API — there is no
 * special-cased path. Server functions ARE the API layer (no REST handlers).
 */

import { createServerFn } from '@tanstack/react-start'
import { operations, type Doc } from '@latha/core'
import { getCMS } from '../cms/instance'

const COLLECTION = 'posts'

/**
 * Wire-serializable shape of a post. The kernel returns loosely-typed `Doc`s
 * (a dynamic record); server functions must return a concrete serializable
 * type, so we project the `Doc` onto this known shape at the boundary.
 */
export interface PostRecord {
  id: string
  title: string
  slug: string | null
  content: string | null
  status: string | null
  views: number | null
  createdAt: string | null
  updatedAt: string | null
}

function toPost(doc: Doc): PostRecord {
  return {
    id: doc.id,
    title: String(doc.title ?? ''),
    slug: (doc.slug as string | null) ?? null,
    content: (doc.content as string | null) ?? null,
    status: (doc.status as string | null) ?? null,
    views: (doc.views as number | null) ?? null,
    createdAt: (doc.createdAt as string | null) ?? null,
    updatedAt: (doc.updatedAt as string | null) ?? null,
  }
}

// In Phase 1 there is no auth yet, so we run as an anonymous context.
// Phase 4 will resolve the real user from the request via the AuthAdapter.
async function ctx() {
  return { cms: await getCMS(), user: null }
}

export const listPosts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PostRecord[]> => {
    const docs = await operations.find(await ctx(), COLLECTION, {
      sort: [{ field: 'createdAt', direction: 'desc' }],
    })
    return docs.map(toPost)
  },
)

export const getPost = createServerFn({ method: 'GET' })
  .validator((id: unknown) => String(id))
  .handler(async ({ data: id }): Promise<PostRecord | null> => {
    const doc = await operations.findOne(await ctx(), COLLECTION, id)
    return doc ? toPost(doc) : null
  })

export const createPost = createServerFn({ method: 'POST' })
  .validator((data: unknown) => {
    const input = (data ?? {}) as Record<string, unknown>
    if (typeof input.title !== 'string' || input.title.trim() === '') {
      throw new Error('A post title is required.')
    }
    return input
  })
  .handler(async ({ data }): Promise<PostRecord> => {
    return toPost(await operations.create(await ctx(), COLLECTION, data))
  })

export const deletePost = createServerFn({ method: 'POST' })
  .validator((id: unknown) => String(id))
  .handler(async ({ data: id }): Promise<{ id: string }> => {
    await operations.destroy(await ctx(), COLLECTION, id)
    return { id }
  })
