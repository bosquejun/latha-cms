/**
 * Kon10Setup — the first-run screen that creates the first admin.
 *
 * Mounted at the configured `setupPath`, and deliberately styled as a sibling
 * of {@link Kon10Login}: same branded backdrop, same card, same branding hooks,
 * so first run doesn't feel like a different product.
 *
 * The page is a state machine over `client.setupStatus()`:
 *   - checking      — nothing rendered but a placeholder; we don't know yet
 *   - unsupported   — the identity source can't create accounts (external IdP)
 *   - done          — an admin already exists; bounce to login
 *   - needs a token — production; show how to derive it rather than the form
 *   - ready         — show the form
 *
 * Password rules are the server's (`setupInputSchema` in `@kon10/auth`), not
 * this file's: it must stay client-safe and cannot import that package, so the
 * hint below is copy only and the server is authoritative on rejection.
 */

import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  Field,
  Input,
  PasswordInput,
} from '@kon10/ui'
import { Slot, useKon10, type SetupStatus } from '@kon10/studio-sdk'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { resolveBrandLogo } from './logo.js'

/** Mirrors `MIN_PASSWORD_LENGTH` in `@kon10/auth`; copy only — server decides. */
const MIN_PASSWORD_HINT = 12

/** Read the setup token from the URL. Client-only; returns null during SSR. */
function tokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('token')
}

export function Kon10Setup() {
  const { client, basePath, loginPath, branding } = useKon10()
  const navigate = useNavigate()

  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const logo = resolveBrandLogo(branding.logo)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await client.setupStatus()
      if (cancelled) return
      setStatus(next)
      setToken(tokenFromUrl())
      // Nothing to do here: either it's already done, or this install can
      // never do it. Either way the login screen is the right destination.
      if (!next.needsSetup || !next.supported) void navigate({ to: loginPath })
    })()
    return () => {
      cancelled = true
    }
  }, [client, navigate, loginPath])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await client.setup({
        email,
        password,
        name: name || undefined,
        token: token ?? undefined,
      })
      if (!res.ok) {
        setError(res.error ?? 'Could not complete setup.')
        return
      }
      // `setup` signs the new admin in, so go straight to the Studio.
      await navigate({ to: basePath })
    } finally {
      setBusy(false)
    }
  }

  const needsToken = status?.tokenRequired && !token

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
        <Slot zone="setup.header" className="mb-page-gap flex flex-col gap-group" />

        <div className="mb-page-gap flex justify-center">
          <span className="grid size-16 place-items-center overflow-hidden rounded-[var(--radius-lg)] shadow-lg ring-1 ring-white/10 [&_svg]:size-full">
            {logo}
          </span>
        </div>

        {status === null ? (
          <Card className="gap-card-gap border-white/10 bg-white/[0.03] p-card backdrop-blur-sm">
            <p className="text-center text-small text-muted-foreground">Checking setup…</p>
          </Card>
        ) : needsToken ? (
          <SetupTokenInstructions />
        ) : (
          <Card className="gap-card-gap border-white/10 bg-white/[0.03] p-card backdrop-blur-sm">
            <div className="flex flex-col gap-tight text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                {branding.setupTitle ?? `Welcome to ${branding.appName}`}
              </h1>
              <p className="text-small text-muted-foreground">
                {branding.setupSubtitle ?? 'Create the admin account to get started.'}
              </p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-form" noValidate>
              <Slot zone="setup.form.before" className="flex flex-col gap-form" />
              <Field htmlFor="name" label="Name">
                <Input
                  id="name"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field htmlFor="email" label="Email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field
                htmlFor="password"
                label="Password"
                description={`At least ${MIN_PASSWORD_HINT} characters.`}
              >
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  placeholder="••••••••••••"
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
                {busy ? 'Creating admin…' : 'Create admin'}
                {!busy && (
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                )}
              </Button>
              <Slot zone="setup.form.after" className="flex flex-col gap-form" />
            </form>
          </Card>
        )}

        <p className="mt-group text-center text-caption text-muted-foreground">
          Powered by {branding.appName}
        </p>
        <Slot zone="setup.footer" className="mt-group flex flex-col gap-tight" />
      </div>
    </main>
  )
}

/**
 * Shown in production when the URL carries no token. The token is derived from
 * `AUTH_SECRET`, so anyone entitled to set this install up can compute it —
 * and nobody else can, which is what keeps a fresh public deploy from being
 * claimed by the first visitor who finds it.
 */
function SetupTokenInstructions() {
  const command =
    `node -e "console.log(require('crypto')` +
    `.createHmac('sha256',process.env.AUTH_SECRET)` +
    `.update('kon10:setup').digest('base64url'))"`

  return (
    <Card className="gap-card-gap border-white/10 bg-white/[0.03] p-card backdrop-blur-sm">
      <div className="flex flex-col gap-tight text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Setup is protected</h1>
        <p className="text-small text-muted-foreground">
          This install is running in production, so creating the first admin needs a setup
          token. Derive it from your <code>AUTH_SECRET</code>:
        </p>
      </div>
      <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-black/40 p-3 text-caption text-muted-foreground">
        <code>{command}</code>
      </pre>
      <p className="text-small text-muted-foreground">
        Then open this page with <code>?token=…</code> appended. The token stops working as
        soon as the first admin exists.
      </p>
    </Card>
  )
}
