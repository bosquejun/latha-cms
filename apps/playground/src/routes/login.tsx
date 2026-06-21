import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, Field, Input } from '@latha/ui'
import { getCurrentUser, loginFn } from '../server/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    // Already signed in → straight to the admin.
    const user = await getCurrentUser()
    if (user) throw redirect({ to: '/admin' })
  },
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@latha.dev')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await loginFn({ data: { email, password } })
      if (!res.ok) {
        setError('Invalid email or password.')
        return
      }
      await navigate({ to: '/admin' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm gap-5">
        <div>
          <h1 className="text-lg font-semibold">Sign in to LathaCMS</h1>
          <p className="text-sm text-muted-foreground">
            Seeded dev login: <code>admin@latha.dev</code> / <code>password</code>
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
