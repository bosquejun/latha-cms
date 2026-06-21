import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getGlobal, saveGlobal } from '../server/content'

export const Route = createFileRoute('/settings')({
  loader: () => getGlobal({ data: 'site-settings' }),
  component: SettingsPage,
})

function SettingsPage() {
  const settings = Route.useLoaderData()
  const router = useRouter()
  const [siteName, setSiteName] = useState(String(settings?.site_name ?? ''))
  const [tagline, setTagline] = useState(String(settings?.tagline ?? ''))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    if (!siteName.trim()) return
    setBusy(true)
    setSaved(false)
    try {
      await saveGlobal({
        data: { slug: 'site-settings', data: { site_name: siteName, tagline } },
      })
      await router.invalidate()
      setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="pagehead">
        <h1>Site settings</h1>
        <Link to="/" className="link">
          ← Posts
        </Link>
      </div>

      <p className="muted">
        A <code>Document</code> singleton — exactly one record, no list view.
      </p>

      <form onSubmit={onSave} className="stack">
        <label className="field">
          <span>Site name</span>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="My site"
          />
        </label>
        <label className="field">
          <span>Tagline</span>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <div>
          <button type="submit" disabled={busy || !siteName.trim()}>
            Save
          </button>
          {saved && <span className="ok"> saved ✓</span>}
        </div>
      </form>
    </>
  )
}
