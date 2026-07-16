/**
 * Kon10Login — drop-in sign-in screen. Mount it at the configured `loginPath`.
 *
 * Modern, minimal, and fully brandable: the logo, app name, and login copy all
 * come from `branding` on `<Kon10Provider>` (see {@link Kon10Branding}), so an
 * app rebrands this screen without forking it. With no branding configured it
 * renders the default Kon10 mark and copy.
 */

import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  Field,
  Input,
  PasswordInput,
} from '@kon10/ui'
import { useKon10 } from '@kon10/studio-sdk'
import { CircleAlert } from 'lucide-react'
import { Kon10Logo } from './logo.js'

export function Kon10Login() {
  const { client, basePath, branding } = useKon10()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const logo = branding.logo ?? <Kon10Logo />
  const title = branding.loginTitle ?? 'Welcome back'
  const subtitle = branding.loginSubtitle ?? `Sign in to continue to ${branding.appName}`

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-page">
      {/* Ambient brand glow — a soft primary-tinted wash behind the card that
          keeps the minimal layout from feeling empty. Decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklch,var(--color-primary)_22%,transparent),transparent_70%)]"
      />
      <div className="w-full max-w-[400px]">
        <div className="mb-page-gap flex flex-col items-center gap-group text-center">
          <span className="grid size-14 place-items-center overflow-hidden rounded-[var(--radius-lg)] shadow-sm ring-1 ring-border [&_svg]:size-full">
            {logo}
          </span>
          <div className="flex flex-col gap-tight">
            <h1 className="text-h1 font-semibold tracking-tight">{title}</h1>
            <p className="text-small text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Card className="gap-card-gap p-card">
          <form onSubmit={onSubmit} className="flex flex-col gap-form" noValidate>
            <Field htmlFor="email" label="Email">
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field htmlFor="password" label="Password">
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="mt-tight w-full"
              disabled={busy || !email || !password}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
        <p className="mt-group text-center text-caption text-muted-foreground">
          Powered by {branding.appName}
        </p>
      </div>
    </main>
  )
}
