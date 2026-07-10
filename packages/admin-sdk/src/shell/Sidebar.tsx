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
import { LayoutDashboard } from 'lucide-react'
import { ChevronDownIcon } from 'lucide-animated'
import { cn } from '@kon10/ui'
import { Slot } from '../extensions/Slot.js'

/** Accepts both plain lucide-react icons and lucide-animated icons. */
export type SidebarIcon = ComponentType<{ className?: string }>

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
  icon?: SidebarIcon
  /** Render as a plain `<a>` opening a new tab (skips the router Link). */
  external?: boolean
}

/** A heading and its links. An omitted/empty `label` renders headless. */
export interface SidebarSection {
  key: string
  /** Section heading. Omit (or empty) to render the items with no heading. */
  label?: string
  items: SidebarItem[]
  /**
   * Render the group as an expandable menu row (icon + label + chevron) with
   * its items nested beneath, instead of a static uppercase heading. Default
   * false.
   */
  collapsible?: boolean
  /** Start collapsed (only when `collapsible`). Default false. */
  defaultCollapsed?: boolean
  /** Leading icon for a collapsible group's menu row. */
  icon?: SidebarIcon
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
  /** Render the fixed Dashboard entry above the sections. Default true. */
  showDashboard?: boolean
  /** Pinned to the top, above the nav (e.g. a back button in a sub-sidebar). */
  header?: ReactNode
  /** Pinned to the bottom of the sidebar (e.g. a Settings button). */
  footer?: ReactNode
  /** Extra classes for the nav container (e.g. the drawer stretches it). */
  className?: string
}

// `pointer-coarse:min-h-11` keeps every nav row at a ~44px touch target in
// the mobile drawer without loosening the desktop pointer density.
const linkClass = (active: boolean) =>
  cn(
    'flex touch-manipulation items-center gap-2.5 rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors pointer-coarse:min-h-11',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'border-sidebar-border bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-2xs [&_svg]:text-foreground'
      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 [&_svg]:text-muted-foreground',
  )

const sectionLabelClass =
  'px-3 pb-1 text-label font-medium uppercase tracking-wider text-muted-foreground'

// A collapsible group's heading: same shape and weight as a nav link, so the
// group reads as a top-level menu item rather than a section label.
const groupHeaderClass = (active: boolean) =>
  cn(
    'flex w-full touch-manipulation items-center justify-between rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors pointer-coarse:min-h-11',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'font-medium text-sidebar-accent-foreground [&_svg]:text-foreground'
      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 [&_svg]:text-muted-foreground',
  )

export function Sidebar({
  sections,
  currentPath,
  LinkComponent,
  homeHref = '/admin',
  onNavigate,
  showDashboard = true,
  header,
  footer,
  className,
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
    <nav
      className={cn(
        'flex h-full w-(--sidebar-width) shrink-0 flex-col gap-card-gap overflow-y-auto border-r border-sidebar-border bg-sidebar p-sidebar',
        className,
      )}
    >
      {header}
      <Slot zone="shell.sidebar.top" />

      {/* Every top-level entry — Dashboard, ungrouped items, and group rows —
          shares one rhythm so the menu reads as a single, even list. `flex-1`
          lets the footer settle at the bottom. */}
      <div className="flex flex-1 flex-col gap-stack">
        {showDashboard
          ? renderLink(
              { key: '__dashboard', href: homeHref, label: 'Dashboard', icon: LayoutDashboard },
              currentPath === homeHref,
            )
          : null}

        {sections.map((section) => (
          <SidebarSectionView
            key={section.key}
            section={section}
            renderLink={renderLink}
            isActive={isActive}
          />
        ))}
      </div>

      <Slot zone="shell.sidebar.bottom" />
      {footer}
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
  // A collapsible group reads as a menu row of its own; everything else is a
  // plain list under an optional static heading.
  if (section.collapsible && section.label) {
    return (
      <CollapsibleGroup
        section={section}
        renderLink={renderLink}
        isActive={isActive}
      />
    )
  }
  return (
    <div className="flex flex-col gap-stack">
      {section.label ? <p className={sectionLabelClass}>{section.label}</p> : null}
      {section.items.map((item) => renderLink(item, isActive(item)))}
    </div>
  )
}

/** A group rendered as an expandable menu row with its items nested beneath. */
function CollapsibleGroup({
  section,
  renderLink,
  isActive,
}: {
  section: SidebarSection
  renderLink: (item: SidebarItem, active: boolean) => ReactNode
  isActive: (item: SidebarItem) => boolean
}) {
  const hasActive = section.items.some(isActive)
  const [open, setOpen] = useState(!section.defaultCollapsed || hasActive)
  const Icon = section.icon

  return (
    <div className="flex flex-col gap-stack">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={groupHeaderClass(!open && hasActive)}
      >
        <span className="flex items-center gap-2.5">
          {Icon ? <Icon /> : null}
          {section.label}
        </span>
        <ChevronDownIcon
          className={cn('transition-transform', !open && '-rotate-90')}
        />
      </button>
      {open ? (
        <div className="ml-[1.4rem] flex flex-col gap-stack border-l border-sidebar-border pl-2">
          {section.items.map((item) => renderLink(item, isActive(item)))}
        </div>
      ) : null}
    </div>
  )
}
