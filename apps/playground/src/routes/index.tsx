import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@latha/ui'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-page px-6">
      <div className="flex items-baseline gap-group">
        <h1 className="text-3xl font-semibold tracking-tight">LathaCMS</h1>
        <span className="text-sm text-muted-foreground">playground</span>
      </div>
      <p className="text-muted-foreground">
        A config-driven, modular headless CMS on TanStack Start. This whole app
        is a{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
          latha.config.ts
        </code>{' '}
        plus a one-line server endpoint and two mount points — the admin UI,
        API, and auth all come from <code className="rounded bg-muted px-1.5 py-0.5 text-sm">@latha/start</code>.
      </p>
      <Button asChild>
        <Link to="/admin/$" params={{ _splat: '' }}>
          Open the admin →
        </Link>
      </Button>
    </main>
  )
}
