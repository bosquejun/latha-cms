/**
 * Sidebar — derived from the module registry's entities.
 *
 * Styled to the LathaCMS design system: a barely-lifted `--sidebar` surface, a
 * rounded-square logo mark + wordmark, and nav items grouped by entity kind
 * under tiny tracked uppercase section labels. Links are plain anchors by
 * default; pass `LinkComponent` to integrate a router's `Link` (e.g. TanStack
 * Router) for client-side navigation and active styling.
 */

import type { ComponentType, ReactNode } from 'react'
import {
  FileText,
  Files,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@latha/ui'
import type { AdminNavItem, EntityKind } from '../schema.js'
import { Slot } from '../extensions/Slot.js'

export interface SidebarLinkProps {
  href: string
  className?: string
  children: ReactNode
  onClick?: () => void
}

/** A single link inside an extension-contributed sidebar group. */
export interface SidebarExtraItem {
  key: string
  href: string
  label: string
  icon?: LucideIcon
  /** Render as a plain `<a>` (new tab) rather than the router Link. */
  external?: boolean
}

/** A heading + links contributed by extensions (custom pages, nav links). */
export interface SidebarGroup {
  label: string
  items: SidebarExtraItem[]
}

export interface SidebarProps {
  items: AdminNavItem[]
  /** Current pathname, used to highlight the active item with default links. */
  currentPath?: string
  /** Optional router Link component. */
  LinkComponent?: ComponentType<SidebarLinkProps>
  /** Brand / wordmark (no longer rendered; kept to avoid breaking callers). */
  title?: string
  homeHref?: string
  /** Extension-contributed groups, rendered below the entity groups. */
  extraGroups?: SidebarGroup[]
  /** Called whenever the user clicks any nav link. */
  onNavigate?: () => void
}

const GROUP_LABEL: Record<EntityKind, string> = {
  collection: 'Content',
  document: 'Configuration',
  taxonomy: 'Taxonomies',
}

const GROUP_ORDER: EntityKind[] = ['collection', 'document', 'taxonomy']

const KIND_ICON: Record<EntityKind, LucideIcon> = {
  collection: FileText,
  document: Files,
  taxonomy: FolderTree,
}

const linkClass = (active: boolean) =>
  cn(
    'flex items-center gap-2.5 rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'border-sidebar-border bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-2xs [&_svg]:text-foreground'
      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 [&_svg]:text-muted-foreground',
  )

export function Sidebar({
  items,
  currentPath,
  LinkComponent,
  // title kept in SidebarProps for backwards-compat but no longer rendered
  homeHref = '/admin',
  extraGroups,
  onNavigate,
}: SidebarProps) {
  const groups = GROUP_ORDER.map((kind) => ({
    kind,
    label: GROUP_LABEL[kind],
    items: items.filter((i) => i.kind === kind),
  })).filter((g) => g.items.length > 0)

  const renderLink = (
    key: string,
    href: string,
    active: boolean,
    children: ReactNode,
    external = false,
  ) => {
    if (LinkComponent && !external) {
      return (
        <LinkComponent key={key} href={href} className={linkClass(active)} onClick={() => onNavigate?.()}>
          {children}
        </LinkComponent>
      )
    }
    return (
      <a
        key={key}
        href={href}
        className={linkClass(active)}
        onClick={() => onNavigate?.()}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }

  const sectionLabel = (label: string) => (
    <p className="px-3 pb-1 text-label font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
  )

  const dashboardActive = currentPath === homeHref

  return (
    <nav className="flex h-full w-(--sidebar-width) shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar p-sidebar">
      <Slot zone="shell.sidebar.top" />

      <div className="flex flex-col gap-stack">
        {sectionLabel('Overview')}
        {renderLink(
          '__dashboard',
          homeHref,
          dashboardActive,
          <>
            <LayoutDashboard />
            Dashboard
          </>,
        )}
      </div>

      {groups.map((group) => {
        const Icon = KIND_ICON[group.kind]
        return (
          <div key={group.kind} className="flex flex-col gap-stack">
            {sectionLabel(group.label)}
            {group.items.map((item) =>
              renderLink(
                item.slug,
                item.href,
                currentPath?.startsWith(item.href) ?? false,
                <>
                  <Icon />
                  {item.label}
                </>,
              ),
            )}
          </div>
        )
      })}

      {extraGroups?.map((group) => (
        <div key={`x:${group.label}`} className="flex flex-col gap-stack">
          {sectionLabel(group.label)}
          {group.items.map((item) => {
            const Icon = item.icon
            return renderLink(
              item.key,
              item.href,
              !item.external && (currentPath?.startsWith(item.href) ?? false),
              <>
                {Icon ? <Icon /> : null}
                {item.label}
              </>,
              item.external,
            )
          })}
        </div>
      ))}

      <Slot zone="shell.sidebar.bottom" />
    </nav>
  )
}
