/**
 * LathaLogin — drop-in sign-in screen. Mount it at the configured `loginPath`.
 */

import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, Field, Input } from '@latha/ui'
import { useLatha } from '@latha/admin-sdk'

export function LathaLogin() {
  const { client, basePath } = useLatha()
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
        setError('Invalid email or password.')
        return
      }
      await navigate({ to: basePath })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-[22px] flex items-center justify-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-primary text-base font-semibold text-primary-foreground">
            L
          </span>
          <span className="text-lg font-semibold tracking-tight">LathaCMS</span>
        </div>
        <Card className="gap-6 p-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Welcome back</h1>
            <p className="text-small text-muted-foreground">
              Enter your credentials to continue.
            </p>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field htmlFor="email" label="Email">
              <Input id="email" type="email" autoComplete="username"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field htmlFor="password" label="Password" error={error ?? undefined}>
              <Input id="password" type="password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" className="mt-1 w-full" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
