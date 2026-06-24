/**
 * Sidebar — a fixed Dashboard entry plus a list of sections, in two widths.
 *
 * Section render styles:
 *  - **loose** (no `label`): items render as flat top-level links.
 *  - **accordion** (`collapsible`): an expandable parent row (icon + chevron)
 *    over indented children.
 *  - **heading** (labelled, not collapsible): an uppercase section heading.
 *
 * The whole rail can collapse to an icon strip (persisted in `localStorage`).
 * Collapsed, leaf items show a hover tooltip and grouped sections (accordion /
 * heading) open as a hover/focus flyout listing their children.
 */

import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Folder,
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
  /** Icon for the accordion parent row / collapsed flyout trigger. */
  icon?: LucideIcon
  /** Render as an expandable accordion parent (vs. a static heading). */
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
  /** Allow collapsing to an icon rail (desktop). Default true. */
  collapsible?: boolean
  /** Called whenever the user clicks any nav link. */
  onNavigate?: () => void
}

const STORAGE_KEY = 'latha:sidebar-collapsed'

const linkClass = (active: boolean) =>
  cn(
    'flex items-center gap-2.5 rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'border-sidebar-border bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-2xs [&_svg]:text-foreground'
      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 [&_svg]:text-muted-foreground',
  )

const railClass = (active: boolean) =>
  cn(
    'flex size-9 items-center justify-center rounded-md border border-transparent transition-colors',
    '[&_svg]:size-[18px] [&_svg]:shrink-0',
    active
      ? 'border-sidebar-border bg-sidebar-accent text-foreground'
      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 [&_svg]:text-muted-foreground',
  )

const sectionLabelClass =
  'px-3 pb-1 text-label font-medium uppercase tracking-wider text-muted-foreground'

const flyoutPanelClass =
  'invisible absolute left-full top-0 z-50 ml-2 hidden min-w-44 flex-col gap-stack rounded-lg border border-sidebar-border bg-sidebar p-2 opacity-0 shadow-lg group-hover/fly:visible group-hover/fly:flex group-hover/fly:opacity-100 group-focus-within/fly:visible group-focus-within/fly:flex group-focus-within/fly:opacity-100'

const tooltipClass =
  'pointer-events-none invisible absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs font-medium text-sidebar-foreground opacity-0 shadow-md group-hover/fly:visible group-hover/fly:opacity-100'

export function Sidebar({
  sections,
  currentPath,
  LinkComponent,
  homeHref = '/admin',
  collapsible = true,
  onNavigate,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Restore persisted state after mount (avoids an SSR hydration mismatch).
  useEffect(() => {
    if (!collapsible) return
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, [collapsible])

  const toggleCollapsed = () =>
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })

  const rail = collapsible && collapsed

  const isActive = (item: SidebarItem) =>
    !item.external && (currentPath?.startsWith(item.href) ?? false)

  const renderLink = (
    item: SidebarItem,
    active: boolean,
    variant: 'full' | 'rail' | 'flyout' = 'full',
  ) => {
    const className = variant === 'rail' ? railClass(active) : linkClass(active)
    const body =
      variant === 'rail' ? (
        item.icon ? <item.icon /> : <Folder />
      ) : (
        <>
          {item.icon ? <item.icon /> : null}
          {item.label}
        </>
      )
    const shared = {
      className,
      onClick: () => onNavigate?.(),
    }
    if (LinkComponent && !item.external) {
      return (
        <LinkComponent key={item.key} href={item.href} {...shared}>
          {body}
        </LinkComponent>
      )
    }
    return (
      <a
        key={item.key}
        href={item.href}
        {...shared}
        {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {body}
      </a>
    )
  }

  return (
    <nav
      data-collapsed={rail}
      className={cn(
        'flex h-full shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar transition-[width]',
        rail
          ? 'w-16 items-center overflow-visible px-2 py-sidebar'
          : 'w-(--sidebar-width) overflow-y-auto p-sidebar',
      )}
    >
      <Slot zone="shell.sidebar.top" />

      <div className="flex flex-col gap-stack">
        {rail
          ? renderTooltipItem(
              { key: '__dashboard', href: homeHref, label: 'Dashboard', icon: LayoutDashboard },
              currentPath === homeHref,
              renderLink,
            )
          : renderLink(
              { key: '__dashboard', href: homeHref, label: 'Dashboard', icon: LayoutDashboard },
              currentPath === homeHref,
            )}
      </div>

      {sections.map((section) => (
        <SidebarSectionView
          key={section.key}
          section={section}
          rail={rail}
          renderLink={renderLink}
          isActive={isActive}
        />
      ))}

      <div className="mt-auto flex flex-col gap-stack">
        <Slot zone="shell.sidebar.bottom" />
        {collapsible && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(rail ? railClass(false) : linkClass(false), 'w-full justify-start')}
          >
            {rail ? <PanelLeftOpen /> : <PanelLeftClose />}
            {!rail && <span>Collapse</span>}
          </button>
        )}
      </div>
    </nav>
  )
}

/** A collapsed leaf: icon trigger with a hover tooltip showing the label. */
function renderTooltipItem(
  item: SidebarItem,
  active: boolean,
  renderLink: (item: SidebarItem, active: boolean, variant: 'full' | 'rail' | 'flyout') => ReactNode,
) {
  return (
    <div key={item.key} className="group/fly relative">
      {renderLink(item, active, 'rail')}
      <span className={tooltipClass}>{item.label}</span>
    </div>
  )
}

function SidebarSectionView({
  section,
  rail,
  renderLink,
  isActive,
}: {
  section: SidebarSection
  rail: boolean
  renderLink: (item: SidebarItem, active: boolean, variant: 'full' | 'rail' | 'flyout') => ReactNode
  isActive: (item: SidebarItem) => boolean
}) {
  const hasActive = section.items.some(isActive)
  const grouped = Boolean(section.label) // accordion or heading
  const [open, setOpen] = useState(
    !section.collapsible || !section.defaultCollapsed,
  )
  const expanded = section.collapsible ? open || hasActive : true
  const Icon = section.icon ?? Folder

  // ── Collapsed rail ────────────────────────────────────────────────────────
  if (rail) {
    // Loose items: each a tooltip icon.
    if (!grouped) {
      return (
        <div className="flex flex-col gap-stack">
          {section.items.map((item) =>
            renderTooltipItem(item, isActive(item), renderLink),
          )}
        </div>
      )
    }
    // Grouped (accordion / heading): one icon that opens a flyout of children.
    return (
      <div className="group/fly relative flex flex-col">
        <button type="button" className={railClass(hasActive)} aria-label={section.label}>
          <Icon />
        </button>
        <div className={flyoutPanelClass}>
          <p className="px-2 pb-1 text-label font-medium uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>
          {section.items.map((item) => renderLink(item, isActive(item), 'flyout'))}
        </div>
      </div>
    )
  }

  // ── Expanded ──────────────────────────────────────────────────────────────
  // Loose items.
  if (!grouped) {
    return (
      <div className="flex flex-col gap-stack">
        {section.items.map((item) => renderLink(item, isActive(item), 'full'))}
      </div>
    )
  }

  // Accordion: expandable parent row over indented children.
  if (section.collapsible) {
    return (
      <div className="flex flex-col gap-stack">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(linkClass(hasActive && !expanded), 'justify-between')}
        >
          <span className="flex items-center gap-2.5">
            <Icon />
            {section.label}
          </span>
          <ChevronDown
            className={cn('size-4 transition-transform', !expanded && '-rotate-90')}
          />
        </button>
        {expanded && (
          <div className="ml-[1.0625rem] flex flex-col gap-stack border-l border-sidebar-border pl-2">
            {section.items.map((item) => renderLink(item, isActive(item), 'full'))}
          </div>
        )}
      </div>
    )
  }

  // Heading: static uppercase label over its items.
  return (
    <div className="flex flex-col gap-stack">
      <p className={sectionLabelClass}>{section.label}</p>
      {section.items.map((item) => renderLink(item, isActive(item), 'full'))}
    </div>
  )
}
