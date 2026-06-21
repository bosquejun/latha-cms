import { createFileRoute, Link } from '@tanstack/react-router'
import { Card } from '@latha/ui'
import { getNav } from '../server/admin'

export const Route = createFileRoute('/admin/')({
  loader: () => getNav(),
  component: Dashboard,
})

const KIND_LABEL: Record<string, string> = {
  collection: 'Collection',
  document: 'Document',
  taxonomy: 'Taxonomy',
}

function Dashboard() {
  const nav = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Everything below is derived from the module registry.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {nav.map((item) => (
          <Link key={item.slug} to={item.href}>
            <Card className="gap-1 py-4 transition-colors hover:border-primary/40">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {KIND_LABEL[item.kind] ?? item.kind}
              </span>
              <span className="text-base font-medium">{item.label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
