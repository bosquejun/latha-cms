import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import {
  createPost,
  deletePost,
  listPosts,
} from '../server/posts'

export const Route = createFileRoute('/')({
  loader: () => listPosts(),
  component: PostsPage,
})

function PostsPage() {
  const posts = Route.useLoaderData()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('draft')
  const [busy, setBusy] = useState(false)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      await createPost({ data: { title, status } })
      setTitle('')
      setStatus('draft')
      await router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    setBusy(true)
    try {
      await deletePost({ data: id })
      await router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Posts</h1>

      <form onSubmit={onCreate}>
        <input
          type="text"
          placeholder="New post title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="draft">draft</option>
          <option value="published">published</option>
        </select>
        <button type="submit" disabled={busy || !title.trim()}>
          Create
        </button>
      </form>

      {posts.length === 0 ? (
        <p className="empty">No posts yet — create the first one above.</p>
      ) : (
        <ul className="posts">
          {posts.map((post) => (
            <li key={String(post.id)}>
              <span className="grow">
                <strong>{String(post.title)}</strong>{' '}
                <span className="muted">/{String(post.slug ?? '')}</span>
              </span>
              <span className="pill">{String(post.status ?? 'draft')}</span>
              <button
                className="ghost"
                onClick={() => onDelete(String(post.id))}
                disabled={busy}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
