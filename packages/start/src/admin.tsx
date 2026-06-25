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
  registerFieldRenderer,
  type SidebarItem,
  type SidebarSection,
  type SidebarLinkProps,
  PermissionsProvider,
  useCan,
  useLatha,
  useAsync,
  type EntityDescriptor,
  type NavItem,
  type NavSection,
} from '@latha/admin-sdk'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@latha/ui'
import {
  Plus,
  FileText,
  Files,
  Folder,
  FolderTree,
  Settings,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { RelationshipField } from './fields/RelationshipField.js'

// Register the client-aware relationship renderer into the SDK registry so
// relationship fields (e.g. roles.permissions, users.roles) get a real picker.
registerFieldRenderer('relationship', RelationshipField)

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

/** Parse an entity route (`content/<slug>[/new|/<id>]` or `documents/<slug>`). */
function parseEntitySegs(seg: string[]): Route | null {
  if (seg[0] === 'content' && seg[1]) {
    if (seg[2] === 'new') return { view: 'create', slug: seg[1] }
    if (seg[2]) return { view: 'edit', slug: seg[1], id: seg[2] }
    return { view: 'list', slug: seg[1] }
  }
  if (seg[0] === 'documents' && seg[1]) return { view: 'document', slug: seg[1] }
  return null
}

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

  const entity = parseEntitySegs(seg)
  if (entity) return entity

  if (seg[0] === 'settings') {
    const sub = seg.slice(1)
    // Entities living in the settings area (`/admin/settings/content/users`).
    const settingsEntity = parseEntitySegs(sub)
    if (settingsEntity) return settingsEntity
    const settingsSlug = sub[0]
    if (!settingsSlug) return { view: 'settings', params: [] }
    const page = ext.settingsFor(settingsSlug)
    if (page) return { view: 'settings', page, params: sub.slice(1) }
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

// Default ordering: ungrouped items sit at the top (no heading), named groups
// sit below. Any entry overrides these via its own `order`.
const ORDER_UNGROUPED = -100
const ORDER_EXT_GROUP = 100

interface RawItem extends SidebarItem {
  order: number
}

interface RawSection {
  key: string
  label: string
  order: number
  collapsible?: boolean
  defaultCollapsed?: boolean
  items: RawItem[]
}

/** A non-entity sidebar entry (custom page, nav link, or settings page). */
interface ExtraEntry {
  key: string
  href: string
  label: string
  icon?: LucideIcon
  external?: boolean
  /** Group heading; omit for a free-floating ungrouped entry. */
  group?: string
  order?: number
}

/**
 * Assemble one sidebar from server entity sections plus extension-contributed
 * `extras`. Used identically for the main and the settings sidebars — only the
 * inputs differ — so both share the same grouping and ordering behaviour.
 *
 * Ordering is uniform: every top-level entry (a group, or a single ungrouped
 * item) carries an `order`, and items within a group carry their own `order`.
 * Lower sorts first. Groups merge by label; ungrouped items each become their
 * own headless entry so they can be positioned freely among the groups.
 */
function buildSidebar(nav: NavSection[], extras: ExtraEntry[]): SidebarSection[] {
  const groups = new Map<string, RawSection>()
  const singles: RawSection[] = []

  const groupFor = (label: string, order: number, extra?: Partial<RawSection>) => {
    let section = groups.get(label)
    if (!section) {
      section = { key: `grp:${label}`, label, order, items: [], ...extra }
      groups.set(label, section)
    } else {
      section.order = Math.min(section.order, order)
      if (extra?.collapsible) section.collapsible = true
    }
    return section
  }
  const single = (key: string, item: RawItem) =>
    singles.push({ key, label: '', order: item.order, items: [item] })

  // Entities, grouped by the server. A labelled group stays a group; an
  // ungrouped entity becomes its own top-level entry.
  for (const section of nav) {
    const items: RawItem[] = section.items.map((item) => ({
      key: item.slug,
      href: item.href,
      label: item.label,
      icon: KIND_ICON[item.kind] ?? FileText,
      order: item.order ?? 0,
    }))
    if (section.label) {
      groupFor(section.label, section.order, {
        collapsible: section.collapsible,
        defaultCollapsed: section.defaultCollapsed,
      }).items.push(...items)
    } else {
      for (const item of items) single(`e:${item.key}`, { ...item, order: item.order || ORDER_UNGROUPED })
    }
  }

  // Extension entries: grouped by `group`, or a free-floating ungrouped entry.
  for (const extra of extras) {
    const item: RawItem = {
      key: extra.key,
      href: extra.href,
      label: extra.label,
      icon: extra.icon,
      external: extra.external,
      order: extra.order ?? 0,
    }
    if (extra.group) groupFor(extra.group, extra.order ?? ORDER_EXT_GROUP).items.push(item)
    else single(item.key, { ...item, order: extra.order ?? ORDER_UNGROUPED })
  }

  const sections = [...groups.values(), ...singles]
  for (const section of sections) section.items.sort((a, b) => a.order - b.order)
  sections.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))

  return sections.map((section) => ({
    key: section.key,
    label: section.label || undefined,
    collapsible: section.collapsible,
    defaultCollapsed: section.defaultCollapsed,
    // A collapsible group renders as a menu row, so give it a leading folder icon.
    icon: section.collapsible ? Folder : undefined,
    items: section.items,
  }))
}

/** Flatten the extension registry into the extras for the main sidebar. */
function mainExtras(ext: ExtensionRegistry, basePath: string): ExtraEntry[] {
  return [
    ...ext.pages
      .filter((page) => !page.hidden)
      .map((page) => ({
        key: `page:${page.path}`,
        href: `${basePath}/${page.path}`,
        label: page.label,
        icon: page.icon,
        group: page.group,
        order: page.order,
      })),
    ...ext.nav.map((link) => ({
      key: `nav:${link.href}`,
      href: link.href,
      label: link.label,
      icon: link.icon,
      external: link.external,
      group: link.group,
      order: link.order,
    })),
  ]
}

/** Settings pages become the extras for the settings sidebar. */
function settingsExtras(ext: ExtensionRegistry, basePath: string): ExtraEntry[] {
  return ext.settings.map((page) => ({
    key: `settings:${page.path}`,
    href: `${basePath}/settings/${page.path}`,
    label: page.label,
    icon: page.icon ?? Settings,
    order: page.order,
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
  const mainNav = navSections.filter((section) => section.area !== 'settings')
  const settingsNav = navSections.filter((section) => section.area === 'settings')

  const mainSections = buildSidebar(mainNav, mainExtras(extensions, basePath))
  const settingsSections = buildSidebar(settingsNav, settingsExtras(extensions, basePath))

  // The settings area swaps the whole sidebar; the path under `/admin/settings`
  // decides which sidebar shows. The footer button lands on the first settings
  // entry so clicking it opens straight into a usable page.
  const settingsRoot = `${basePath}/settings`
  const inSettings = pathname === settingsRoot || pathname.startsWith(`${settingsRoot}/`)
  const firstSettingsHref = settingsSections[0]?.items[0]?.href ?? settingsRoot
  const hasSettings = settingsSections.length > 0

  return (
    <PermissionsProvider permissions={session.data.permissions}>
      <AdminShell
        sections={inSettings ? settingsSections : mainSections}
        currentPath={pathname}
        LinkComponent={RouterLink}
        brand="LathaCMS"
        showDashboard={!inSettings}
        sidebarHeader={inSettings ? <SettingsBackHeader basePath={basePath} /> : undefined}
        sidebarFooter={
          !inSettings && hasSettings ? <SettingsNavButton href={firstSettingsHref} /> : undefined
        }
        userMenu={
          <UserMenu
            email={session.data.email}
            role={session.data.roles.join(', ') || null}
            theme={theme}
            onThemeChange={setTheme}
            onSignOut={async () => {
              await client.logout()
              await navigate({ to: loginPath })
            }}
          />
        }
      >
        <AdminView route={route} nav={mainNav} routeBase={inSettings ? settingsRoot : basePath} />
      </AdminShell>
    </PermissionsProvider>
  )
}

/** Footer entry in the main sidebar that opens the settings area. */
function SettingsNavButton({ href }: { href: string }) {
  return (
    <div className="border-t border-sidebar-border pt-3">
      <Link
        to={href}
        className="flex items-center justify-between gap-2.5 rounded-md border border-transparent px-3 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
      >
        <span className="flex items-center gap-2.5">
          <Settings />
          Settings
        </span>
        <ChevronRight />
      </Link>
    </div>
  )
}

/** Header of the settings sidebar: a back chevron + the "Settings" title. */
function SettingsBackHeader({ basePath }: { basePath: string }) {
  return (
    <Link
      to={basePath}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
    >
      <ChevronLeft />
      Settings
    </Link>
  )
}

function AdminView({
  route,
  nav,
  routeBase,
}: {
  route: Route
  nav: NavSection[]
  /** Base for entity sub-routes — `/admin` or `/admin/settings`. */
  routeBase: string
}) {
  switch (route.view) {
    case 'dashboard':
      return <Dashboard nav={nav} />
    case 'list':
      return <ListView slug={route.slug} base={routeBase} />
    case 'create':
      return <CreateView slug={route.slug} base={routeBase} />
    case 'edit':
      return <EditView slug={route.slug} id={route.id} base={routeBase} />
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

function ListView({ slug, base }: { slug: string; base: string }) {
  const { client } = useLatha()
  const can = useCan()
  const entity = useAsync(() => client.entity(slug), [slug])
  const rows = useAsync(() => client.list(slug), [slug])

  if (entity.loading || rows.loading)
    return <p className="text-small text-muted-foreground">Loading…</p>
  if (!entity.data)
    return <p className="text-small text-muted-foreground">Unknown collection.</p>

  const canCreate = can(`${slug}:create`)
  const canDelete = can(`${slug}:delete`)
  const list = rows.data ?? []
  return (
    <>
      <Slot zone="list.before" entity={entity.data} data={{ rows: list }} />
      <PageHeader
        title={entity.data.label}
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link to={`${base}/content/${slug}/new`}>
                <Plus /> New
              </Link>
            </Button>
          ) : undefined
        }
      />
      {list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={`No ${entity.data.label.toLowerCase()} yet`}
          description={`Create your first to start managing ${entity.data.label.toLowerCase()}.`}
          action={
            canCreate ? (
              <Button asChild size="sm" className="mt-1">
                <Link to={`${base}/content/${slug}/new`}>
                  <Plus /> New
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <CollectionList
            entity={asEntity(entity.data)}
            rows={list}
            getEditHref={(id) => `${base}/content/${slug}/${id}`}
            onDelete={
              canDelete
                ? async (id) => {
                    await client.remove(slug, id)
                    rows.reload()
                  }
                : undefined
            }
          />
        </Card>
      )}
      <Slot zone="list.after" entity={entity.data} data={{ rows: list }} />
    </>
  )
}

function CreateView({ slug, base }: { slug: string; base: string }) {
  const { client } = useLatha()
  const navigate = useNavigate()
  const entity = useAsync(() => client.entity(slug), [slug])

  if (entity.loading) return <p className="text-small text-muted-foreground">Loading…</p>
  if (!entity.data) return <p className="text-small text-muted-foreground">Unknown collection.</p>

  const toList = () => navigate({ to: `${base}/content/${slug}` })

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

function EditView({ slug, id, base }: { slug: string; id: string; base: string }) {
  const { client } = useLatha()
  const can = useCan()
  const navigate = useNavigate()
  const entity = useAsync(() => client.entity(slug), [slug])
  const doc = useAsync(() => client.get(slug, id), [slug, id])

  if (entity.loading || doc.loading) return <p className="text-small text-muted-foreground">Loading…</p>
  if (!entity.data) return <p className="text-small text-muted-foreground">Unknown collection.</p>
  if (!doc.data) return <p className="text-small text-muted-foreground">Record not found.</p>

  const toList = () => navigate({ to: `${base}/content/${slug}` })

  return (
    <>
      <PageHeader
        title={`Edit ${entity.data.label.toLowerCase()}`}
        actions={
          can(`${slug}:delete`) ? (
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
          ) : undefined
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
