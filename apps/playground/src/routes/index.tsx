import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@latha/ui'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">LathaCMS</h1>
        <span className="text-sm text-muted-foreground">playground · phase 3</span>
      </div>
      <p className="text-muted-foreground">
        A config-driven, modular headless CMS on TanStack Start. The admin UI
        below is fully auto-generated from <code className="rounded bg-muted px-1.5 py-0.5 text-sm">cms.config.ts</code>{' '}
        — sidebar, list views, and forms all derive from the module registry.
      </p>
      <Button asChild>
        <Link to="/admin">Open the admin →</Link>
      </Button>
    </main>
  )
}
