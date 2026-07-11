/**
 * MobileMenu — scrim + slide-in sheet with the full navigation (below `lg`,
 * where the tab strip and section sidebar are hidden). Top-level tabs render
 * as a vertical list; the active tab's sub-items nest beneath it behind a
 * left rule, so the sheet is the one place navigation stays vertical.
 *
 * Overlays the full viewport height — including the top bars — like a native
 * mobile nav sheet, so it carries its own header (brand + close button).
 * Behaves like a modal dialog on touch: Escape closes it, the page behind
 * stops scrolling while it's open, and the closed panel is `visibility:
 * hidden` (kept in the transition list so the slide-out finishes first) so
 * off-screen links can't be focused or read by assistive tech.
 */
import { useEffect, type ComponentType } from 'react'
import { X } from 'lucide-react'
import { Button, cn } from '@kon10/ui'
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
}

const itemClass = (active: boolean) =>
  cn(
    'flex touch-manipulation items-center gap-2.5 rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors pointer-coarse:min-h-11',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    active
      ? 'border-nav-border bg-nav-accent font-medium text-nav-accent-foreground shadow-2xs [&_svg]:text-foreground'
      : 'text-nav-item-foreground hover:bg-nav-accent/60 [&_svg]:text-muted-foreground',
  )

export function MobileMenu({
  open,
  onClose,
  items,
  activeKey,
  activeSubKey,
  LinkComponent,
  brand = 'Kon10',
}: MobileMenuProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  const renderLink = (
    entry: ShellNavItem | ShellNavSubItem,
    active: boolean,
    className: string,
  ) => {
    const body = (
      <>
        {entry.icon ? <entry.icon /> : null}
        {entry.label}
      </>
    )
    if (LinkComponent && !entry.external) {
      return (
        <LinkComponent key={entry.key} href={entry.href} className={className} onClick={onClose}>
          {body}
        </LinkComponent>
      )
    }
    return (
      <a
        key={entry.key}
        href={entry.href}
        aria-current={active ? 'page' : undefined}
        className={className}
        onClick={onClose}
        {...(entry.external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {body}
      </a>
    )
  }

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        data-open={open}
        className="fixed inset-0 z-50 bg-[oklch(0_0_0/0.4)] opacity-0 transition-opacity duration-200 data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 pointer-events-none lg:hidden"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        data-open={open}
        className="invisible fixed inset-y-0 left-0 z-[60] flex w-[280px] max-w-[85vw] -translate-x-full flex-col bg-nav pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] transition-[transform,visibility] duration-[220ms] [transition-timing-function:cubic-bezier(.4,0,.2,1)] data-[open=true]:visible data-[open=true]:translate-x-0 lg:hidden"
      >
        {/* Sheet header — mirrors the top bar brand, plus a close button. */}
        <div className="flex h-(--header-height) shrink-0 items-center justify-between gap-inline border-b border-nav-border px-nav">
          <div className="flex min-w-0 items-center gap-inline">
            <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-primary text-sm font-semibold text-primary-foreground">
              {brand.charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-base font-semibold tracking-tight">{brand}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2 [&_svg]:size-[18px]"
          >
            <X />
          </Button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-card-gap overflow-y-auto p-nav">
          <Slot zone="shell.sidebar.top" />
          <div className="flex flex-1 flex-col gap-stack">
            {items.map((item) => {
              const active = item.key === activeKey
              const subs = active ? (item.subItems ?? []) : []
              return (
                <div key={item.key} className="flex flex-col gap-stack">
                  {renderLink(item, active, itemClass(active))}
                  {subs.length > 0 ? (
                    <div className="ml-[1.4rem] flex flex-col gap-stack border-l border-nav-border pl-2">
                      {subs.flatMap((group) =>
                        group.items.map((sub) =>
                          renderLink(sub, sub.key === activeSubKey, itemClass(sub.key === activeSubKey)),
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <Slot zone="shell.sidebar.bottom" />
        </nav>
      </div>
    </>
  )
}
