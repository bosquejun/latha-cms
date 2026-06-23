/**
 * AdminShell — full-width topbar over a (sidebar + content) row.
 * Owns the mobile drawer open state. Data-agnostic: pages render their own
 * PageHeader inside `children`. Scattered `<Slot>`s expose the shell's chrome
 * (topbar ends, sidebar top/bottom, main before/after) to extensions.
 */
import { useState, type ComponentType, type ReactNode } from 'react'
import { Sidebar, type SidebarGroup, type SidebarLinkProps } from './Sidebar.js'
import { Topbar } from './Topbar.js'
import { MobileDrawer } from './MobileDrawer.js'
import { Slot } from '../extensions/Slot.js'
import type { AdminNavItem } from '../schema.js'

export interface AdminShellProps {
  nav: AdminNavItem[]
  currentPath?: string
  LinkComponent?: ComponentType<SidebarLinkProps>
  brand?: string
  userMenu?: ReactNode
  /** Extension-contributed sidebar groups (custom pages, nav links). */
  extraGroups?: SidebarGroup[]
  children: ReactNode
}

export function AdminShell({
  nav,
  currentPath,
  LinkComponent,
  brand = 'LathaCMS',
  userMenu,
  extraGroups,
  children,
}: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Topbar brand={brand} onMenuClick={() => setDrawerOpen(true)}>
        <div className="flex items-center gap-3">
          <Slot zone="shell.topbar.start" className="flex items-center gap-2" />
          {userMenu}
          <Slot zone="shell.topbar.end" className="flex items-center gap-2" />
        </div>
      </Topbar>
      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-(--header-height) h-[calc(100vh-var(--header-height))] max-[860px]:hidden">
          <Sidebar
            items={nav}
            currentPath={currentPath}
            LinkComponent={LinkComponent}
            extraGroups={extraGroups}
          />
        </aside>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          items={nav}
          currentPath={currentPath}
          LinkComponent={LinkComponent}
          extraGroups={extraGroups}
        />
        <main className="min-w-0 flex-1 p-page">
          <div className="mx-auto w-full max-w-content-max">
            <Slot zone="shell.main.before" />
            {children}
            <Slot zone="shell.main.after" />
          </div>
        </main>
      </div>
    </div>
  )
}
