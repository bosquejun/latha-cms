/**
 * Sidebar — a fixed "Overview" entry plus a list of sections.
 *
 * A section is a heading and its links. Entity sections (one per module, by
 * default) and extension-contributed sections (custom pages, nav links,
 * settings) share the same `SidebarSection` shape, so they render identically.
 * Sections can opt into a collapsible group; the default is a flat heading.
 * Links are plain anchors unless a router `LinkComponent` is supplied.
 */

import { useState, type ComponentType, type ReactNode } from 'react'
import {
  ChevronDown,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@latha/ui'
import { Slot } from '../extensions/Slot.js'

export interface SidebarLinkProps {
  href: string
  className?: string
  children: ReactNode
  onClick?: () => void
}

/** A single sidebar link. */
export interface SidebarItem {
  key: string
  href: string
  label: string
  icon?: LucideIcon
  /** Render as a plain `<a>` opening a new tab (skips the router Link). */
  external?: boolean
}

/** A heading and its links. An omitted/empty `label` renders headless. */
export interface SidebarSection {
  key: string
  /** Section heading. Omit (or empty) to render the items with no heading. */
  label?: string
  items: SidebarItem[]
  /** Render the heading as a collapse toggle. Default false (static heading). */
  collapsible?: boolean
  /** Start collapsed (only when `collapsible`). Default false. */
  defaultCollapsed?: boolean
}

export interface SidebarProps {
  /** Sidebar sections, in display order. */
  sections: SidebarSection[]
  /** Current pathname, used to highlight the active item. */
  currentPath?: string
  /** Optional router Link component. */
  LinkComponent?: ComponentType<SidebarLinkProps>
  homeHref?: string
  /** Called whenever the user clicks any nav link. */
  onNavigate?: () => void
}

const linkClass = (active: boolean) =>
  cn(
    'flex items-center gap-2.5 rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'border-sidebar-border bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-2xs [&_svg]:text-foreground'
      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 [&_svg]:text-muted-foreground',
  )

const sectionLabelClass =
  'px-3 pb-1 text-label font-medium uppercase tracking-wider text-muted-foreground'

export function Sidebar({
  sections,
  currentPath,
  LinkComponent,
  homeHref = '/admin',
  onNavigate,
}: SidebarProps) {
  const renderLink = (item: SidebarItem, active: boolean) => {
    const body = (
      <>
        {item.icon ? <item.icon /> : null}
        {item.label}
      </>
    )
    if (LinkComponent && !item.external) {
      return (
        <LinkComponent
          key={item.key}
          href={item.href}
          className={linkClass(active)}
          onClick={() => onNavigate?.()}
        >
          {body}
        </LinkComponent>
      )
    }
    return (
      <a
        key={item.key}
        href={item.href}
        className={linkClass(active)}
        onClick={() => onNavigate?.()}
        {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {body}
      </a>
    )
  }

  const isActive = (item: SidebarItem) =>
    !item.external && (currentPath?.startsWith(item.href) ?? false)

  return (
    <nav className="flex h-full w-(--sidebar-width) shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar p-sidebar">
      <Slot zone="shell.sidebar.top" />

      <div className="flex flex-col gap-stack">
        {renderLink(
          { key: '__dashboard', href: homeHref, label: 'Dashboard', icon: LayoutDashboard },
          currentPath === homeHref,
        )}
      </div>

      {sections.map((section) => (
        <SidebarSectionView
          key={section.key}
          section={section}
          renderLink={renderLink}
          isActive={isActive}
        />
      ))}

      <Slot zone="shell.sidebar.bottom" />
    </nav>
  )
}

function SidebarSectionView({
  section,
  renderLink,
  isActive,
}: {
  section: SidebarSection
  renderLink: (item: SidebarItem, active: boolean) => ReactNode
  isActive: (item: SidebarItem) => boolean
}) {
  const hasActive = section.items.some(isActive)
  // Collapsible sections start per their config, but always open to reveal an
  // active child.
  const [open, setOpen] = useState(
    !section.collapsible || !section.defaultCollapsed || hasActive,
  )
  const expanded = section.collapsible ? open || hasActive : true

  return (
    <div className="flex flex-col gap-stack">
      {!section.label ? null : section.collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(sectionLabelClass, 'flex items-center justify-between')}
        >
          {section.label}
          <ChevronDown
            className={cn('size-3.5 transition-transform', !expanded && '-rotate-90')}
          />
        </button>
      ) : (
        <p className={sectionLabelClass}>{section.label}</p>
      )}
      {expanded &&
        section.items.map((item) => renderLink(item, isActive(item)))}
    </div>
  )
}
