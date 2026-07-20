/**
 * MobileMenu — scrim + slide-in sheet with the full navigation (below `lg`,
 * where the tab strip and section sidebar are hidden). Top-level tabs render
 * as a vertical list; tabs with sub-items have an independent disclosure
 * toggle, so users can inspect another section without navigating away.
 * The active section opens automatically and its active child stays visible.
 *
 * Overlays the full viewport height — including the top bars — like a native
 * mobile nav sheet, so it carries its own header (brand + close button).
 * Behaves like a modal dialog on touch: Escape closes it, the page behind
 * stops scrolling while it's open, and the closed panel is `visibility:
 * hidden` (kept in the transition list so the slide-out finishes first) so
 * off-screen links can't be focused or read by assistive tech.
 */
import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, cn } from '@kon10/ui'
import { Slot } from '../extensions/Slot.js'
import type { NavLinkProps, ShellNavItem, ShellNavSubItem } from './nav.js'

export interface MobileMenuProps {
  open: boolean
  onClose: () => void
  items: ShellNavItem[]
  activeKey?: string
  activeSubKey?: string
  LinkComponent?: ComponentType<NavLinkProps>
  brand?: string
  /** Brand logo element for the mark; falls back to a lettermark from `brand`. */
  logo?: ReactNode
}

const itemClass = (active: boolean) =>
  cn(
    'flex min-h-tap touch-manipulation items-center gap-2.5 rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'border-nav-border border-l-primary bg-nav-accent font-medium text-nav-accent-foreground shadow-2xs [&_svg]:text-foreground'
      : 'text-nav-item-foreground hover:bg-nav-accent/60 [&_svg]:text-muted-foreground',
  )

const parentRowClass = (active: boolean, expanded: boolean) =>
  cn(
    'flex min-h-tap items-stretch overflow-hidden rounded-md border transition-colors',
    active
      ? 'border-nav-border bg-nav-accent/80 text-nav-accent-foreground shadow-2xs'
      : expanded
        ? 'border-nav-border/70 bg-nav-accent/35 text-nav-foreground'
        : 'border-transparent text-nav-item-foreground hover:bg-nav-accent/60',
  )

const parentLinkClass =
  'flex min-w-0 flex-1 touch-manipulation items-center gap-2.5 px-3 py-1.5 text-sm font-medium outline-none focus-visible:bg-nav-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

const subItemClass = (active: boolean) =>
  cn(
    'flex min-h-tap touch-manipulation items-center gap-2.5 rounded-md border-l-2 px-3 py-1.5 text-sm transition-colors',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'border-l-primary bg-nav-accent font-medium text-nav-accent-foreground shadow-2xs [&_svg]:text-foreground'
      : 'border-l-transparent text-nav-item-foreground hover:bg-nav-accent/60 [&_svg]:text-muted-foreground',
  )

export function MobileMenu({
  open,
  onClose,
  items,
  activeKey,
  activeSubKey,
  LinkComponent,
  brand = 'Kon10',
  logo,
}: MobileMenuProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Whenever the drawer opens, reveal the current page in its hierarchy.
  // Other sections keep the user's explicit expanded/collapsed choices.
  useEffect(() => {
    if (!open || !activeKey) return
    const activeItem = items.find((item) => item.key === activeKey)
    const hasSubItems = activeItem?.subItems?.some((group) => group.items.length > 0)
    if (!hasSubItems) return
    setExpanded((current) =>
      current[activeKey] === true ? current : { ...current, [activeKey]: true },
    )
  }, [activeKey, items, open])

  const renderLink = (
    entry: ShellNavItem | ShellNavSubItem,
    current: boolean,
    className: string,
  ) => {
    const body = (
      <>
        {entry.icon ? <entry.icon /> : null}
        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
      </>
    )
    if (LinkComponent && !entry.external) {
      return (
        <LinkComponent
          key={entry.key}
          href={entry.href}
          aria-current={current ? 'page' : undefined}
          className={className}
          onClick={onClose}
        >
          {body}
        </LinkComponent>
      )
    }
    return (
      <a
        key={entry.key}
        href={entry.href}
        aria-current={current ? 'page' : undefined}
        className={className}
        onClick={onClose}
        {...(entry.external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {body}
      </a>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <SheetContent
        side="left"
        closeLabel="Close menu"
        closeClassName="right-nav top-[calc(var(--space-2)+env(safe-area-inset-top))] text-nav-item-foreground hover:bg-nav-accent hover:text-nav-foreground md:right-nav md:top-[calc(var(--space-2)+env(safe-area-inset-top))] md:size-tap"
        overlayClassName="lg:hidden"
        className="w-(--panel-left) max-w-[85vw] gap-0 overflow-hidden rounded-none border-nav-border bg-nav p-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-nav-foreground lg:hidden"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          document.querySelector<HTMLButtonElement>('[data-studio-menu-trigger]')?.focus()
        }}
      >
        {/* Sheet header — mirrors the top bar brand, plus a close button. */}
        <div className="flex h-(--header-height) shrink-0 items-center gap-inline border-b border-nav-border px-nav pr-16">
          <div className="flex min-w-0 items-center gap-inline">
            {logo ? (
              <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)] [&_img]:size-full [&_svg]:size-full">
                {logo}
              </span>
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-primary text-sm font-semibold text-primary-foreground">
                {brand.charAt(0).toUpperCase()}
              </span>
            )}
            <SheetTitle className="truncate pr-0 text-base font-semibold tracking-tight">
              {brand}
            </SheetTitle>
          </div>
        </div>
        <nav
          aria-label="Navigation"
          className="flex min-h-0 flex-1 touch-pan-y flex-col gap-card-gap overscroll-contain overflow-y-auto p-nav"
        >
          <Slot zone="shell.sidebar.top" />
          <div className="flex flex-1 flex-col gap-stack">
            {items.map((item, itemIndex) => {
              const active = item.key === activeKey
              const groups = item.subItems ?? []
              const hasSubItems = groups.some((group) => group.items.length > 0)
              const isExpanded = hasSubItems && (expanded[item.key] ?? active)
              const submenuId = `studio-mobile-submenu-${itemIndex}`
              return (
                <div key={item.key} className="flex flex-col gap-stack">
                  {hasSubItems ? (
                    <div className={parentRowClass(active, isExpanded)}>
                      {renderLink(item, active && !activeSubKey, parentLinkClass)}
                      <button
                        type="button"
                        aria-controls={submenuId}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
                        onClick={() =>
                          setExpanded((current) => ({
                            ...current,
                            [item.key]: !(current[item.key] ?? active),
                          }))
                        }
                        className="grid min-h-tap min-w-tap shrink-0 touch-manipulation place-items-center border-l border-nav-border/70 text-muted-foreground outline-none transition-colors hover:bg-nav-accent hover:text-nav-foreground focus-visible:bg-nav-accent focus-visible:text-nav-foreground"
                      >
                        <ChevronRight
                          className={cn(
                            'size-4 transition-transform duration-200',
                            isExpanded && 'rotate-90',
                          )}
                        />
                      </button>
                    </div>
                  ) : (
                    renderLink(item, active, itemClass(active))
                  )}
                  {isExpanded ? (
                    <div
                      id={submenuId}
                      className="ml-[1.4rem] flex flex-col gap-group border-l border-nav-border pl-2"
                    >
                      {groups.map((group, groupIndex) => (
                        <div
                          key={group.label ?? groupIndex}
                          className="flex flex-col gap-stack"
                        >
                          {group.label ? (
                            <p className="px-group pt-1 text-label font-medium uppercase tracking-wider text-muted-foreground">
                              {group.label}
                            </p>
                          ) : null}
                          {group.items.map((sub) =>
                            renderLink(
                              sub,
                              sub.key === activeSubKey,
                              subItemClass(sub.key === activeSubKey),
                            ),
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <Slot zone="shell.sidebar.bottom" />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
