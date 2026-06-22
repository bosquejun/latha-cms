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

export interface SidebarLinkProps {
  href: string
  className?: string
  children: ReactNode
}

export interface SidebarProps {
  items: AdminNavItem[]
  /** Current pathname, used to highlight the active item with default links. */
  currentPath?: string
  /** Optional router Link component. */
  LinkComponent?: ComponentType<SidebarLinkProps>
  /** Brand / wordmark shown at the top. */
  title?: string
  homeHref?: string
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
  title = 'LathaCMS',
  homeHref = '/admin',
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
  ) => {
    if (LinkComponent) {
      return (
        <LinkComponent key={key} href={href} className={linkClass(active)}>
          {children}
        </LinkComponent>
      )
    }
    return (
      <a key={key} href={href} className={linkClass(active)}>
        {children}
      </a>
    )
  }

  const sectionLabel = (label: string) => (
    <p className="px-3 pb-1 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
  )

  const dashboardActive = currentPath === homeHref

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4">
      <a href={homeHref} className="flex items-center gap-2.5 px-1 py-1">
        <span className="grid size-8 place-items-center rounded-[14px] bg-primary text-sm font-semibold text-primary-foreground">
          {title.charAt(0).toUpperCase()}
        </span>
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          {title}
        </span>
      </a>

      <div className="flex flex-col gap-1">
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
          <div key={group.kind} className="flex flex-col gap-1">
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
    </nav>
  )
}
