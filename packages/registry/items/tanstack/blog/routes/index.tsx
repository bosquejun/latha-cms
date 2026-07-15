import { createFileRoute } from '@tanstack/react-router'
import { kon10 } from '@/lib/kon10'
import { postSchema } from '@/lib/posts'
import { PostCard } from '@/components/blog/post-card'

export const Route = createFileRoute('/blog/')({
  loader: () =>
    kon10.list('contents/posts', {
      sort: '-createdAt',
      where: { status: 'published' },
      schema: postSchema,
    }),
  component: BlogIndexPage,
})

function BlogIndexPage() {
  const { data: posts } = Route.useLoaderData()
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Blog</h1>
      {posts.length === 0 ? (
        <p className="text-muted-foreground">No posts published yet.</p>
      ) : (
        <div className="grid gap-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  )
}
