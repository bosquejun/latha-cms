import { z } from 'zod'

/**
 * The shape this blog template expects from your Studio's `posts` collection.
 *
 * It's a hand-written starting point so the template is self-contained. Once
 * your model settles, replace it with the generated schema:
 *
 *   npx @kon10/cli typegen --url $VITE_KON10_URL
 *   // then: import { entities } from './kon10.gen'
 *   //       kon10.list('contents/posts', { schema: entities['contents/posts'] })
 */
export const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  createdAt: z.string(),
})

export type Post = z.infer<typeof postSchema>
