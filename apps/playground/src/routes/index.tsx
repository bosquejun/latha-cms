import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { createDoc, deleteDoc, listDocs } from '../server/content'

export const Route = createFileRoute('/')({
  loader: () => listDocs({ data: { collection: 'posts' } }),
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
      await createDoc({ data: { collection: 'posts', data: { title, status } } })
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
      await deleteDoc({ data: { collection: 'posts', id } })
      await router.invalidate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="pagehead">
        <h1>Posts</h1>
        <Link to="/settings" className="link">
          Site settings →
        </Link>
      </div>

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
                <strong>{String(post.title ?? '')}</strong>{' '}
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
