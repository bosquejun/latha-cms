/**
 * StudioShell — the top-nav layout: MainTopNav over a sticky SecondaryTopNav
 * tab strip, over the page content. Top-level sections are tabs, not a
 * reserved side column, so most pages run full-width beneath both bars. A
 * section that owns deep navigation (subItems) gets a sticky SectionSidebar
 * next to its content while it's active — a flush, content-hugging link
 * column, not nav chrome; every other tab stays full-width. Below `lg` both bars collapse
 * into a hamburger + MobileMenu sheet.
 *
 * Owns the mobile menu open state and resolves the active tab/sub-item from
 * `currentPath`. Data-agnostic: pages render their own PageHeader inside
 * `children`. Scattered `<Slot>`s expose the shell's chrome (topbar ends,
 * sidebar top/bottom, main before/after) to extensions.
 *
 * `--shell-top` carries the total sticky chrome height (header, plus tab
 * strip at `lg`) so in-page sticky elements (form action bars) can pin
 * themselves below the chrome at every breakpoint.
 */
import { useState, type ComponentType, type ReactNode } from 'react'
import { Toaster } from '@kon10/ui'
import { MainTopNav } from './MainTopNav.js'
import { SecondaryTopNav } from './SecondaryTopNav.js'
import { SectionSidebar } from './SectionSidebar.js'
import { MobileMenu } from './MobileMenu.js'
import { resolveActiveNav, type NavLinkProps, type ShellNavItem } from './nav.js'
import { Slot } from '../extensions/Slot.js'

export interface StudioShellProps {
  /** Top-level tabs (with optional grouped subItems), in display order. */
  navItems: ShellNavItem[]
  currentPath?: string
  LinkComponent?: ComponentType<NavLinkProps>
  brand?: string
  userMenu?: ReactNode
  /** Width of the rail + page container. Defaults to the centered max-width tier. */
  contentWidth?: 'default' | 'full'
  children: ReactNode
}

export function StudioShell({
  navItems,
  currentPath,
  LinkComponent,
  brand = 'Kon10',
  userMenu,
  contentWidth = 'default',
  children,
}: StudioShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { activeKey, activeSubKey } = resolveActiveNav(navItems, currentPath)
  const activeItem = navItems.find((item) => item.key === activeKey)
  const hasSubNav = Boolean(activeItem?.subItems?.length)
  const activeSubItem = activeItem?.subItems
    ?.flatMap((group) => group.items)
    .find((item) => item.key === activeSubKey)
  const activeContentWidth = activeSubItem?.contentWidth ?? activeItem?.contentWidth ?? contentWidth

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground [--shell-top:var(--header-height)] lg:[--shell-top:calc(var(--header-height)+var(--subnav-height))]">
      <MainTopNav brand={brand} onMenuClick={() => setMenuOpen(true)}>
        <div className="flex items-center gap-group">
          <Slot zone="shell.topbar.start" className="flex items-center gap-inline" />
          {userMenu}
          <Slot zone="shell.topbar.end" className="flex items-center gap-inline" />
        </div>
      </MainTopNav>
      <SecondaryTopNav items={navItems} activeKey={activeKey} LinkComponent={LinkComponent} />
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={navItems}
        activeKey={activeKey}
        activeSubKey={activeSubKey}
        LinkComponent={LinkComponent}
        brand={brand}
      />
      <div className="min-h-0 flex-1">
        <div
          className={
            activeContentWidth === 'full'
              ? 'mx-auto flex min-h-full w-full items-stretch'
              : 'mx-auto flex min-h-full w-full max-w-content-max items-stretch'
          }
        >
          {hasSubNav && activeItem ? (
            <SectionSidebar
              item={activeItem}
              activeSubKey={activeSubKey}
              LinkComponent={LinkComponent}
            />
          ) : null}
          <main className="min-w-0 flex-1 p-page [--container-px:var(--space-page)]">
            <div className="w-full">
            <Slot zone="shell.main.before" />
            {children}
            <Slot zone="shell.main.after" />
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  )
}
