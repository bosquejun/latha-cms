/**
 * LathaLogin — drop-in sign-in screen. Mount it at the configured `loginPath`.
 */

import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, Field, Input } from '@latha/ui'
import { useLatha } from './context.js'

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 px-6">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-[14px] bg-primary text-base font-semibold text-primary-foreground">
          L
        </span>
        <span className="text-lg font-semibold tracking-tight">LathaCMS</span>
      </div>

      <Card className="w-full max-w-sm gap-6 p-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to continue.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field htmlFor="email" label="Email">
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field htmlFor="password" label="Password" error={error ?? undefined}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </main>
  )
}
