/**
 * LathaAdmin — the entire admin UI behind a single catch-all route.
 *
 * Mount it at `<basePath>/$` (e.g. `/admin/$`). It guards the session, derives
 * the sidebar/views from the config (via the RPC client), and routes
 * internally on the splat path. The consuming app writes none of this.
 */

import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  AdminShell,
  CollectionForm,
  CollectionList,
  DocumentForm,
  type AdminEntity,
  type SidebarLinkProps,
} from '@latha/admin-sdk'
import { Avatar, Button, Card } from '@latha/ui'
import { LogOut } from 'lucide-react'
import { useLatha } from './context.js'
import { useAsync } from './hooks.js'
import type { EntityDescriptor, NavItem } from './rpc.js'

function RouterLink({ href, className, children }: SidebarLinkProps) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}

const asEntity = (d: EntityDescriptor) => d as unknown as AdminEntity

/** Two-letter initials from an email/name for the avatar fallback. */
function initials(email: string | null | undefined): string {
  const source = email?.trim()
  if (!source) return '?'
  const name = source.split('@')[0] || source
  const [first, second] = name.split(/[._-]+/).filter(Boolean)
  const chars =
    first && second ? `${first.charAt(0)}${second.charAt(0)}` : name.slice(0, 2)
  return chars.toUpperCase()
}

type Route =
  | { view: 'dashboard' }
  | { view: 'list'; slug: string }
  | { view: 'create'; slug: string }
  | { view: 'edit'; slug: string; id: string }
  | { view: 'document'; slug: string }
  | { view: 'notfound' }

function parseRoute(pathname: string, basePath: string): Route {
  const rest = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length)
    : pathname
  const seg = rest.split('/').filter(Boolean)
  if (seg.length === 0) return { view: 'dashboard' }
  if (seg[0] === 'content' && seg[1]) {
    if (seg[2] === 'new') return { view: 'create', slug: seg[1] }
    if (seg[2]) return { view: 'edit', slug: seg[1], id: seg[2] }
    return { view: 'list', slug: seg[1] }
  }
  if (seg[0] === 'documents' && seg[1]) return { view: 'document', slug: seg[1] }
  return { view: 'notfound' }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export function LathaAdmin() {
  const { client, basePath, loginPath } = useLatha()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const session = useAsync(() => client.currentUser(), [])
  const nav = useAsync(() => client.nav(), [])

  useEffect(() => {
    if (!session.loading && session.data === null) {
      void navigate({ to: loginPath })
    }
  }, [session.loading, session.data, loginPath, navigate])

  if (session.loading || nav.loading) return <Centered>Loading…</Centered>
  if (!session.data) return <Centered>Redirecting…</Centered>

  const route = parseRoute(pathname, basePath)

  return (
    <AdminShell
      nav={nav.data ?? []}
      title="LathaCMS"
      currentPath={pathname}
      LinkComponent={RouterLink}
      actions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar
              size="sm"
              fallback={initials(session.data.email)}
              alt={session.data.email ?? undefined}
            />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.data.email}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={async () => {
              await client.logout()
              await navigate({ to: loginPath })
            }}
          >
            <LogOut />
          </Button>
        </div>
      }
    >
      <AdminView route={route} nav={nav.data ?? []} />
    </AdminShell>
  )
}

function AdminView({ route, nav }: { route: Route; nav: NavItem[] }) {
  switch (route.view) {
    case 'dashboard':
      return <Dashboard nav={nav} />
    case 'list':
      return <ListView slug={route.slug} />
    case 'create':
      return <CreateView slug={route.slug} />
    case 'edit':
      return <EditView slug={route.slug} id={route.id} />
    case 'document':
      return <DocumentView slug={route.slug} />
    default:
      return <p className="text-sm text-muted-foreground">Not found.</p>
  }
}

const KIND_LABEL: Record<string, string> = {
  collection: 'Collection',
  document: 'Document',
  taxonomy: 'Taxonomy',
}

function Dashboard({ nav }: { nav: NavItem[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Everything below is derived from your config.
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

function ListView({ slug }: { slug: string }) {
  const { client, basePath } = useLatha()
  const entity = useAsync(() => client.entity(slug), [slug])
  const rows = useAsync(() => client.list(slug), [slug])

  if (entity.loading || rows.loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!entity.data) return <p className="text-sm text-muted-foreground">Unknown collection.</p>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{entity.data.label}</h2>
        <Button asChild size="sm">
          <Link to={`${basePath}/content/${slug}/new`}>New</Link>
        </Button>
      </div>
      <CollectionList
        entity={asEntity(entity.data)}
        rows={rows.data ?? []}
        getEditHref={(id) => `${basePath}/content/${slug}/${id}`}
        onDelete={async (id) => {
          await client.remove(slug, id)
          rows.reload()
        }}
      />
    </div>
  )
}

function CreateView({ slug }: { slug: string }) {
  const { client, basePath } = useLatha()
  const navigate = useNavigate()
  const entity = useAsync(() => client.entity(slug), [slug])

  if (entity.loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!entity.data) return <p className="text-sm text-muted-foreground">Unknown collection.</p>

  const toList = () => navigate({ to: `${basePath}/content/${slug}` })

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold">New {entity.data.label}</h2>
      <CollectionForm
        entity={asEntity(entity.data)}
        onSubmit={async (values) => {
          await client.create(slug, values)
          await toList()
        }}
        onCancel={toList}
      />
    </div>
  )
}

function EditView({ slug, id }: { slug: string; id: string }) {
  const { client, basePath } = useLatha()
  const navigate = useNavigate()
  const entity = useAsync(() => client.entity(slug), [slug])
  const doc = useAsync(() => client.get(slug, id), [slug, id])

  if (entity.loading || doc.loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!entity.data) return <p className="text-sm text-muted-foreground">Unknown collection.</p>
  if (!doc.data) return <p className="text-sm text-muted-foreground">Record not found.</p>

  const toList = () => navigate({ to: `${basePath}/content/${slug}` })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Edit {entity.data.label}</h2>
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            await client.remove(slug, id)
            await toList()
          }}
        >
          Delete
        </Button>
      </div>
      <CollectionForm
        entity={asEntity(entity.data)}
        initialValues={doc.data}
        onSubmit={async (values) => {
          await client.update(slug, id, values)
          await toList()
        }}
        onCancel={toList}
      />
    </div>
  )
}

function DocumentView({ slug }: { slug: string }) {
  const { client } = useLatha()
  const entity = useAsync(() => client.entity(slug), [slug])
  const value = useAsync(() => client.getGlobal(slug), [slug])

  if (entity.loading || value.loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!entity.data) return <p className="text-sm text-muted-foreground">Unknown document.</p>

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">{entity.data.label}</h2>
        <p className="text-sm text-muted-foreground">
          A document singleton — exactly one record.
        </p>
      </div>
      <DocumentForm
        entity={asEntity(entity.data)}
        value={value.data ?? null}
        onSubmit={async (values) => {
          await client.saveGlobal(slug, values)
          value.reload()
        }}
      />
    </div>
  )
}
