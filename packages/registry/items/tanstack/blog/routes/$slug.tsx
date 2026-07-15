import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { kon10 } from '@/lib/kon10'
import { postSchema } from '@/lib/posts'

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) => {
    const { data } = await kon10.list('contents/posts', {
      where: { slug: params.slug, status: 'published' },
      pageSize: 1,
      schema: postSchema,
    })
    const post = data[0]
    if (!post) throw notFound()
    return post
  },
  component: BlogPostPage,
})

function BlogPostPage() {
  const post = Route.useLoaderData()
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/blog" className="text-sm text-muted-foreground hover:underline">
        ← Back to blog
      </Link>
      <article className="mt-6">
        <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
        <time className="mt-2 block text-sm text-muted-foreground" dateTime={post.createdAt}>
          {new Date(post.createdAt).toLocaleDateString()}
        </time>
        {post.body ? (
          // Kon10 richtext is stored as an HTML string. Sanitize upstream if
          // your authors are untrusted.
          <div className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: post.body }} />
        ) : null}
      </article>
    </main>
  )
}
