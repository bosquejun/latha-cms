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
  EmptyState,
  PageHeader,
  UserMenu,
  useTheme,
  type AdminEntity,
  type SidebarLinkProps,
} from '@latha/admin-sdk'
import { Button, Card } from '@latha/ui'
import { Plus, FileText, Files, FolderTree } from 'lucide-react'
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
    <div className="grid min-h-screen place-items-center text-small text-muted-foreground">
      {children}
    </div>
  )
}

export function LathaAdmin() {
  const { client, basePath, loginPath } = useLatha()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { theme, setTheme } = useTheme()

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
      currentPath={pathname}
      LinkComponent={RouterLink}
      brand="LathaCMS"
      userMenu={
        <UserMenu
          email={session.data.email}
          role={session.data.role}
          theme={theme}
          onThemeChange={setTheme}
          onSignOut={async () => {
            await client.logout()
            await navigate({ to: loginPath })
          }}
        />
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
      return <p className="text-small text-muted-foreground">Not found.</p>
  }
}

const KIND_ICON: Record<string, typeof FileText> = {
  collection: FileText,
  document: Files,
  taxonomy: FolderTree,
}

function Dashboard({ nav }: { nav: NavItem[] }) {
  const { client } = useLatha()
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything below is derived from your config."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {nav.map((item) => {
          const Icon = KIND_ICON[item.kind] ?? FileText
          return (
            <Link key={item.slug} to={item.href}>
              <Card className="gap-0 p-0 transition-colors hover:border-foreground/20">
                <div className="flex items-center justify-between px-4 pt-4">
                  <span className="text-small font-medium text-muted-foreground">
                    {item.label}
                  </span>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <StatCount client={client} item={item} />
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}

function StatCount({ client, item }: { client: ReturnType<typeof useLatha>['client']; item: NavItem }) {
  const count = useAsync(
    () => (item.kind === 'collection' ? client.list(item.slug) : Promise.resolve([])),
    [item.slug, item.kind],
  )
  const value = item.kind === 'collection' ? (count.data?.length ?? '—') : '—'
  return (
    <div className="px-4 pb-4 pt-1.5 text-3xl font-semibold tracking-[-0.02em]">
      {count.loading ? '·' : value}
    </div>
  )
}

function ListView({ slug }: { slug: string }) {
  const { client, basePath } = useLatha()
  const entity = useAsync(() => client.entity(slug), [slug])
  const rows = useAsync(() => client.list(slug), [slug])

  if (entity.loading || rows.loading)
    return <p className="text-small text-muted-foreground">Loading…</p>
  if (!entity.data)
    return <p className="text-small text-muted-foreground">Unknown collection.</p>

  const list = rows.data ?? []
  return (
    <>
      <PageHeader
        title={entity.data.label}
        actions={
          <Button asChild size="sm">
            <Link to={`${basePath}/content/${slug}/new`}>
              <Plus /> New
            </Link>
          </Button>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${entity.data.label.toLowerCase()} yet`}
          description={`Create your first to start managing ${entity.data.label.toLowerCase()}.`}
          action={
            <Button asChild size="sm" className="mt-1">
              <Link to={`${basePath}/content/${slug}/new`}>
                <Plus /> New
              </Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <CollectionList
            entity={asEntity(entity.data)}
            rows={list}
            getEditHref={(id) => `${basePath}/content/${slug}/${id}`}
            onDelete={async (id) => {
              await client.remove(slug, id)
              rows.reload()
            }}
          />
        </Card>
      )}
    </>
  )
}

function CreateView({ slug }: { slug: string }) {
  const { client, basePath } = useLatha()
  const navigate = useNavigate()
  const entity = useAsync(() => client.entity(slug), [slug])

  if (entity.loading) return <p className="text-small text-muted-foreground">Loading…</p>
  if (!entity.data) return <p className="text-small text-muted-foreground">Unknown collection.</p>

  const toList = () => navigate({ to: `${basePath}/content/${slug}` })

  return (
    <>
      <PageHeader
        title={`New ${entity.data.label.toLowerCase()}`}
        description="Draft a new record for this collection."
      />
      <CollectionForm
        entity={asEntity(entity.data)}
        onSubmit={async (values) => {
          await client.create(slug, values)
          await toList()
        }}
        onCancel={toList}
      />
    </>
  )
}

function EditView({ slug, id }: { slug: string; id: string }) {
  const { client, basePath } = useLatha()
  const navigate = useNavigate()
  const entity = useAsync(() => client.entity(slug), [slug])
  const doc = useAsync(() => client.get(slug, id), [slug, id])

  if (entity.loading || doc.loading) return <p className="text-small text-muted-foreground">Loading…</p>
  if (!entity.data) return <p className="text-small text-muted-foreground">Unknown collection.</p>
  if (!doc.data) return <p className="text-small text-muted-foreground">Record not found.</p>

  const toList = () => navigate({ to: `${basePath}/content/${slug}` })

  return (
    <>
      <PageHeader
        title={`Edit ${entity.data.label.toLowerCase()}`}
        actions={
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
        }
      />
      <CollectionForm
        entity={asEntity(entity.data)}
        initialValues={doc.data}
        onSubmit={async (values) => {
          await client.update(slug, id, values)
          await toList()
        }}
        onCancel={toList}
      />
    </>
  )
}

function DocumentView({ slug }: { slug: string }) {
  const { client } = useLatha()
  const entity = useAsync(() => client.entity(slug), [slug])
  const value = useAsync(() => client.getGlobal(slug), [slug])

  if (entity.loading || value.loading) return <p className="text-small text-muted-foreground">Loading…</p>
  if (!entity.data) return <p className="text-small text-muted-foreground">Unknown document.</p>

  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-col gap-field">
        <h2 className="text-h1 font-semibold">{entity.data.label}</h2>
        <p className="text-caption text-muted-foreground">
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
