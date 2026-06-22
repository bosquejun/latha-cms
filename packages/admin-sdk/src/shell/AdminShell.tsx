/**
 * AdminShell — full-width topbar over a (sidebar + content) row.
 * Owns the mobile drawer open state. Data-agnostic: pages render their own
 * PageHeader inside `children`.
 */
import { useState, type ComponentType, type ReactNode } from 'react'
import { Sidebar, type SidebarLinkProps } from './Sidebar.js'
import { Topbar } from './Topbar.js'
import { MobileDrawer } from './MobileDrawer.js'
import type { AdminNavItem } from '../schema.js'

export interface AdminShellProps {
  nav: AdminNavItem[]
  currentPath?: string
  LinkComponent?: ComponentType<SidebarLinkProps>
  brand?: string
  userMenu?: ReactNode
  children: ReactNode
}

export function AdminShell({
  nav,
  currentPath,
  LinkComponent,
  brand = 'LathaCMS',
  userMenu,
  children,
}: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Topbar brand={brand} onMenuClick={() => setDrawerOpen(true)}>
        {userMenu}
      </Topbar>
      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-(--header-height) h-[calc(100vh-var(--header-height))] max-[860px]:hidden">
          <Sidebar items={nav} currentPath={currentPath} LinkComponent={LinkComponent} />
        </aside>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          items={nav}
          currentPath={currentPath}
          LinkComponent={LinkComponent}
        />
        <main className="min-w-0 flex-1 p-page">
          <div className="mx-auto w-full max-w-content-max">{children}</div>
        </main>
      </div>
    </div>
  )
}
