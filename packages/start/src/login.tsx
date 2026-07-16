/**
 * Kon10Login — drop-in sign-in screen. Mount it at the configured `loginPath`.
 *
 * A modern, minimal split screen: a branded ink panel (echoing the logo's
 * black + lime) beside a clean form. Everything visible — logo, app name, the
 * login copy, and the side-panel tagline — comes from `branding` on
 * `<Kon10Provider>` (see {@link Kon10Branding}), so an app rebrands this screen
 * without forking it. Below `lg` the panel drops away and the form centers with
 * a compact brand header. With no branding configured it renders the default
 * Kon10 mark and copy.
 */

import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  Input,
  PasswordInput,
} from '@kon10/ui'
import { useKon10 } from '@kon10/studio-sdk'
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
  const tagline = branding.tagline ?? 'Everything you publish, in one place.'
  const taglineSubtitle =
    branding.taglineSubtitle ??
    'Model content, manage media, and ship a fast delivery API — all from your Studio.'

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
    <main className="min-h-screen w-full bg-background text-foreground lg:grid lg:grid-cols-[1.05fr_1fr] xl:grid-cols-2">
      {/* Branded side panel — fixed ink, mirroring the logo (black tile + lime
          mark), so it reads on-brand in either app theme. Hidden below lg. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0B0B0B] p-10 text-white lg:flex xl:p-14">
        {/* Lime glow bleeding in from a corner */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-[520px] rounded-full blur-3xl [background:radial-gradient(circle,color-mix(in_oklch,var(--color-primary)_38%,transparent),transparent_70%)]"
        />
        {/* Fine grid, faded toward the edges */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage:
              'radial-gradient(120% 90% at 30% 20%, #000 30%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(120% 90% at 30% 20%, #000 30%, transparent 75%)',
          }}
        />

        <div className="relative flex items-center gap-inline">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)] [&_svg]:size-full">
            {logo}
          </span>
          <span className="text-lg font-semibold tracking-tight">{branding.appName}</span>
        </div>

        <div className="relative flex flex-col gap-group">
          <h2 className="max-w-md text-balance text-4xl font-semibold leading-[1.1] tracking-tight">
            {tagline}
          </h2>
          <p className="max-w-md text-pretty text-white/55">{taglineSubtitle}</p>
        </div>
      </aside>

      {/* Form side */}
      <div className="flex min-h-screen items-center justify-center p-page">
        <div className="w-full max-w-[380px]">
          <div className="mb-page-gap flex flex-col items-center gap-group text-center lg:items-start lg:text-left">
            {/* Compact mark — only when the side panel is hidden. */}
            <span className="grid size-12 place-items-center overflow-hidden rounded-[var(--radius-lg)] shadow-sm ring-1 ring-border lg:hidden [&_svg]:size-full">
              {logo}
            </span>
            <div className="flex flex-col gap-tight">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-small text-muted-foreground">{subtitle}</p>
            </div>
          </div>

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
              size="lg"
              className="group mt-tight w-full"
              disabled={busy || !email || !password}
            >
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && (
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              )}
            </Button>
          </form>

          <p className="mt-section text-caption text-muted-foreground">
            Powered by {branding.appName}
          </p>
        </div>
      </div>
    </main>
  )
}
