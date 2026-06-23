/**
 * LathaAdmin — the entire admin UI behind a single catch-all route.
 *
 * Mount it at `<basePath>/$` (e.g. `/admin/$`). It guards the session, derives
 * the sidebar/views from the config (via the RPC client), and routes
 * internally on the splat path. Dev-provided extensions (custom pages, settings
 * pages, dashboard widgets, nav links) are merged into the sidebar and routing;
 * injection-zone widgets render through the `<Slot>`s baked into the shell and
 * views. The consuming app writes none of this.
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
  Slot,
  UserMenu,
  useExtensions,
  useTheme,
  type AdminEntity,
  type DashboardWidgetExtension,
  type ExtensionRegistry,
  type PageExtension,
  type SettingsPageExtension,
  type SidebarItem,
  type SidebarSection,
  type SidebarLinkProps,
} from '@latha/admin-sdk'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@latha/ui'
import { Plus, FileText, Files, FolderTree, Settings, type LucideIcon } from 'lucide-react'
import { useLatha } from './context.js'
import { useAsync } from './hooks.js'
import type { EntityDescriptor, NavItem, NavSection } from './rpc.js'

function RouterLink({ href, className, children, onClick }: SidebarLinkProps) {
  return (
    <Link to={href} className={className} onClick={onClick}>
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
  | { view: 'page'; page: PageExtension; params: string[] }
  | { view: 'settings'; page?: SettingsPageExtension; params: string[] }
  | { view: 'notfound' }

function parseRoute(
  pathname: string,
  basePath: string,
  ext: ExtensionRegistry,
): Route {
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

  if (seg[0] === 'settings') {
    const settingsSlug = seg[1]
    if (!settingsSlug) return { view: 'settings', params: [] }
    const page = ext.settingsFor(settingsSlug)
    if (page) return { view: 'settings', page, params: seg.slice(2) }
    return { view: 'notfound' }
  }

  // Custom pages mount on their first path segment.
  const page = ext.pageFor(seg[0] ?? '')
  if (page) return { view: 'page', page, params: seg.slice(1) }

  return { view: 'notfound' }
}

const KIND_ICON: Record<NavItem['kind'], LucideIcon> = {
  collection: FileText,
  document: Files,
  taxonomy: FolderTree,
}

// Section ordering: ungrouped items float to the top (no heading), named
// extension groups sit in the middle, and the conventional "Settings" area is
// pinned to the bottom.
const SETTINGS_LABEL = 'Settings'
const ORDER_UNGROUPED = -100
const ORDER_EXT_GROUP = 100
const ORDER_SETTINGS = 1000

interface RawSection {
  label: string
  order: number
  collapsible?: boolean
  defaultCollapsed?: boolean
  items: SidebarItem[]
}

/**
 * Merge entity nav sections (from the server) with extension-contributed pages,
 * nav links, and settings into one ordered set of sidebar sections. Items
 * sharing a label collapse into a single section, so e.g. the `users` entity
 * and custom settings pages render together under one "Settings" heading.
 */
function buildSidebar(
  nav: NavSection[],
  ext: ExtensionRegistry,
  basePath: string,
): SidebarSection[] {
  const byLabel = new Map<string, RawSection>()
  const sectionFor = (label: string, order: number, extra?: Partial<RawSection>) => {
    let section = byLabel.get(label)
    if (!section) {
      section = { label, order, items: [], ...extra }
      byLabel.set(label, section)
    } else {
      section.order = Math.min(section.order, order)
      if (extra?.collapsible) section.collapsible = true
    }
    return section
  }

  // Entities, already grouped + ordered by the server.
  for (const section of nav) {
    sectionFor(section.label, section.order, {
      collapsible: section.collapsible,
      defaultCollapsed: section.defaultCollapsed,
    }).items.push(
      ...section.items.map((item) => ({
        key: item.slug,
        href: item.href,
        label: item.label,
        icon: KIND_ICON[item.kind] ?? FileText,
      })),
    )
  }

  // Custom pages and nav links: their `group`, or ungrouped (top, no heading).
  for (const page of ext.pages) {
    if (page.hidden) continue
    const label = page.group ?? ''
    sectionFor(label, label ? ORDER_EXT_GROUP : ORDER_UNGROUPED).items.push({
      key: `page:${page.path}`,
      href: `${basePath}/${page.path}`,
      label: page.label,
      icon: page.icon,
    })
  }
  for (const link of ext.nav) {
    const label = link.group ?? ''
    sectionFor(label, label ? ORDER_EXT_GROUP : ORDER_UNGROUPED).items.push({
      key: `nav:${link.href}`,
      href: link.href,
      label: link.label,
      icon: link.icon,
      external: link.external,
    })
  }

  // Settings pages always collect into the bottom "Settings" area.
  for (const page of ext.settings) {
    sectionFor(SETTINGS_LABEL, ORDER_SETTINGS).items.push({
      key: `settings:${page.path}`,
      href: `${basePath}/settings/${page.path}`,
      label: page.label,
      icon: page.icon ?? Settings,
    })
  }

  return [...byLabel.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((section) => ({
      key: `sec:${section.label || 'ungrouped'}`,
      label: section.label || undefined,
      collapsible: section.collapsible,
      defaultCollapsed: section.defaultCollapsed,
      items: section.items,
    }))
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center text-small text-muted-foreground">
      {children}
    </div>
  )
}

export function LathaAdmin() {
  const { client, basePath, loginPath, extensions } = useLatha()
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

  const route = parseRoute(pathname, basePath, extensions)
  const navSections = nav.data ?? []
  const sections = buildSidebar(navSections, extensions, basePath)

  return (
    <AdminShell
      sections={sections}
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
      <AdminView route={route} nav={navSections} />
    </AdminShell>
  )
}

function AdminView({ route, nav }: { route: Route; nav: NavSection[] }) {
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
    case 'page':
      return <route.page.Component path={route.page.path} params={route.params} />
    case 'settings':
      return <SettingsView page={route.page} params={route.params} />
    default:
      return <p className="text-small text-muted-foreground">Not found.</p>
  }
}

const SPAN_CLASS: Record<number, string> = {
  1: '',
  2: 'col-span-2',
  3: 'col-span-2 lg:col-span-3',
  4: 'col-span-2 lg:col-span-4',
}

function Dashboard({ nav }: { nav: NavSection[] }) {
  const { client } = useLatha()
  const { dashboardWidgets } = useExtensions()
  const items = nav.flatMap((section) => section.items)
  return (
    <>
      <Slot zone="dashboard.before" />
      <PageHeader
        title="Dashboard"
        description="Everything below is derived from your config."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((item) => {
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
        {dashboardWidgets.map((widget, index) => (
          <DashboardWidget key={widget.id ?? index} widget={widget} />
        ))}
      </div>
      <Slot zone="dashboard.after" />
    </>
  )
}

function DashboardWidget({ widget }: { widget: DashboardWidgetExtension }) {
  return (
    <div className={SPAN_CLASS[widget.span ?? 1] ?? ''}>
      <widget.Component zone="dashboard.after" />
    </div>
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
      <Slot zone="list.before" entity={entity.data} data={{ rows: list }} />
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
      <Slot zone="list.after" entity={entity.data} data={{ rows: list }} />
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
        recordId={id}
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
    <>
      <Slot zone="document.before" entity={entity.data} />
      <PageHeader title={entity.data.label} description="A document singleton — exactly one record." />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
            <CardDescription>This document holds exactly one record.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-small text-muted-foreground">
            Edit the fields and save to update the singleton.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{entity.data.label}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DocumentForm
              entity={asEntity(entity.data)}
              value={value.data ?? null}
              onSubmit={async (values) => {
                await client.saveGlobal(slug, values)
                value.reload()
              }}
            />
          </CardContent>
        </Card>
      </div>
      <Slot zone="document.after" entity={entity.data} />
    </>
  )
}

function SettingsView({
  page,
  params,
}: {
  page?: SettingsPageExtension
  params: string[]
}) {
  const { extensions } = useLatha()

  // A specific settings page.
  if (page) return <page.Component path={page.path} params={params} />

  // The settings index — lists registered settings pages.
  const pages = extensions.settings
  return (
    <>
      <PageHeader title="Settings" description="Configure the admin and installed extensions." />
      {pages.length === 0 ? (
        <p className="text-small text-muted-foreground">No settings pages registered.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => {
            const Icon = p.icon ?? Settings
            return (
              <SettingsCard key={p.path} page={p} Icon={Icon} />
            )
          })}
        </div>
      )}
    </>
  )
}

function SettingsCard({
  page,
  Icon,
}: {
  page: SettingsPageExtension
  Icon: typeof Settings
}) {
  const { basePath } = useLatha()
  return (
    <Link to={`${basePath}/settings/${page.path}`}>
      <Card className="transition-colors hover:border-foreground/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" />
            <CardTitle>{page.label}</CardTitle>
          </div>
          {page.description && <CardDescription>{page.description}</CardDescription>}
        </CardHeader>
      </Card>
    </Link>
  )
}
