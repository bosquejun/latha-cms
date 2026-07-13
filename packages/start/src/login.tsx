/**
 * Kon10Login — drop-in sign-in screen. Mount it at the configured `loginPath`.
 */

import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, Field, Input } from '@kon10/ui'
import { useKon10 } from '@kon10/studio-sdk'

export function Kon10Login() {
  const { client, basePath } = useKon10()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await client.login(email, password)
      if (!res.ok) {
        setError(res.error ?? 'Invalid email or password.')
        return
      }
      await navigate({ to: basePath })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-page">
      <div className="w-full max-w-[380px]">
        <div className="mb-page-gap flex items-center justify-center gap-inline">
          <span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-primary text-base font-semibold text-primary-foreground">
            K
          </span>
          <span className="text-lg font-semibold tracking-tight">Kon10</span>
        </div>
        <Card className="gap-card-gap p-card">
          <div className="flex flex-col gap-tight">
            <h1 className="text-h1 font-semibold tracking-tight">Welcome back</h1>
            <p className="text-small text-muted-foreground">
              Enter your credentials to continue.
            </p>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-form">
            <Field htmlFor="email" label="Email">
              <Input id="email" type="email" autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field htmlFor="password" label="Password" error={error ?? undefined}>
              <Input id="password" type="password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
