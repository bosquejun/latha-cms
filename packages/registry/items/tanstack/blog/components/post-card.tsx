import { Link } from '@tanstack/react-router'
import type { Post } from '@/lib/posts'

/** A single post preview in the blog index. */
export function PostCard({ post }: { post: Post }) {
  return (
    <article className="rounded-lg border p-6 transition-colors hover:bg-muted/50">
      <Link to="/blog/$slug" params={{ slug: post.slug }} className="block">
        <h2 className="text-xl font-semibold tracking-tight">{post.title}</h2>
        {post.excerpt ? <p className="mt-2 text-muted-foreground">{post.excerpt}</p> : null}
        <time className="mt-3 block text-sm text-muted-foreground" dateTime={post.createdAt}>
          {new Date(post.createdAt).toLocaleDateString()}
        </time>
      </Link>
    </article>
  )
}
