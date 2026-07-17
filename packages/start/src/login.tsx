/**
 * Kon10Login — drop-in sign-in screen. Mount it at the configured `loginPath`.
 *
 * A modern, minimal centered layout: a single card floats over a branded ink
 * backdrop (soft gold glow + faint grid), with the logo above the card.
 * Everything visible — logo, app name, and the login copy — comes from
 * `branding` on `<Kon10Provider>` (see {@link Kon10Branding}), so an app
 * rebrands this screen without forking it. Injection zones (`login.header`,
 * `login.form.before/after`, `login.footer`) let extensions add to it (e.g. an
 * SSO button) without replacing it. With no branding configured it renders the
 * default Kon10 mark and copy.
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
import { Slot, useKon10 } from '@kon10/studio-sdk'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { resolveBrandLogo } from './logo.js'

export function Kon10Login() {
  const { client, basePath, branding } = useKon10()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const logo = resolveBrandLogo(branding.logo)
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0B0B] p-page text-foreground">
      {/* Gold brand glow, top-center. Decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[760px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl [background:radial-gradient(circle,color-mix(in_oklch,#FFDE59_20%,transparent),transparent_70%)]"
      />
      {/* Fine grid, faded toward the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          maskImage: 'radial-gradient(90% 60% at 50% 0%, #000 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(90% 60% at 50% 0%, #000 40%, transparent 80%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[400px]">
        <Slot zone="login.header" className="mb-page-gap flex flex-col gap-group" />

        {/* Logo above the card. */}
        <div className="mb-page-gap flex justify-center">
          <span className="grid size-16 place-items-center overflow-hidden rounded-[var(--radius-lg)] shadow-lg ring-1 ring-white/10 [&_svg]:size-full">
            {logo}
          </span>
        </div>

        <Card className="gap-card-gap border-white/10 bg-white/[0.03] p-card backdrop-blur-sm">
          <div className="flex flex-col gap-tight text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-small text-muted-foreground">{subtitle}</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-form" noValidate>
            <Slot zone="login.form.before" className="flex flex-col gap-form" />
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
              size="lg"
              className="group mt-tight w-full"
              disabled={busy || !email || !password}
            >
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && (
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              )}
            </Button>
            {branding.signUpUrl && (
              <Button asChild variant="outline" size="lg" className="w-full">
                <a href={branding.signUpUrl}>Sign up</a>
              </Button>
            )}
            <Slot zone="login.form.after" className="flex flex-col gap-form" />
          </form>
        </Card>

        <p className="mt-group text-center text-caption text-muted-foreground">
          Powered by {branding.appName}
        </p>
        <Slot zone="login.footer" className="mt-group flex flex-col gap-tight" />
      </div>
    </main>
  )
}
