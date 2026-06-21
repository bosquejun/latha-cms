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
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm gap-5">
        <h1 className="text-lg font-semibold">Sign in to LathaCMS</h1>
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
