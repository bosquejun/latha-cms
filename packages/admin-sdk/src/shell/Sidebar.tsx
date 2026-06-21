/**
 * Sidebar — derived from the module registry's entities.
 *
 * Nav items are grouped by entity kind. Links are plain anchors by default;
 * pass `LinkComponent` to integrate a router's `Link` (e.g. TanStack Router)
 * for client-side navigation and active styling.
 */

import type { ComponentType, ReactNode } from 'react'
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
  /** Brand / title shown at the top. */
  title?: string
  homeHref?: string
}

const GROUP_LABEL: Record<EntityKind, string> = {
  collection: 'Collections',
  document: 'Documents',
  taxonomy: 'Taxonomies',
}

const GROUP_ORDER: EntityKind[] = ['collection', 'document', 'taxonomy']

const linkClass = (active: boolean) =>
  cn(
    'block rounded-md px-3 py-1.5 text-sm transition-colors',
    active
      ? 'bg-accent font-medium text-accent-foreground'
      : 'text-foreground hover:bg-accent/50',
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

  const renderLink = (item: AdminNavItem) => {
    const active = currentPath?.startsWith(item.href) ?? false
    if (LinkComponent) {
      return (
        <LinkComponent key={item.slug} href={item.href} className={linkClass(active)}>
          {item.label}
        </LinkComponent>
      )
    }
    return (
      <a key={item.slug} href={item.href} className={linkClass(active)}>
        {item.label}
      </a>
    )
  }

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col gap-6 border-r bg-card p-4">
      <a href={homeHref} className="px-3 text-base font-semibold text-foreground">
        {title}
      </a>

      {groups.map((group) => (
        <div key={group.kind} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          {group.items.map(renderLink)}
        </div>
      ))}
    </nav>
  )
}
