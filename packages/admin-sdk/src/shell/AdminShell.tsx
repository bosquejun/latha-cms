/**
 * AdminShell — the admin layout: registry-driven Sidebar + Topbar + content.
 *
 * It owns no data fetching; the app passes nav items (from `buildNav`) and the
 * page content. This keeps the shell reusable and the app in control of
 * routing and data.
 */

import type { ComponentType, ReactNode } from 'react'
import { Sidebar, type SidebarLinkProps } from './Sidebar.js'
import { Topbar } from './Topbar.js'
import type { AdminNavItem } from '../schema.js'

export interface AdminShellProps {
  nav: AdminNavItem[]
  title: ReactNode
  actions?: ReactNode
  currentPath?: string
  LinkComponent?: ComponentType<SidebarLinkProps>
  children: ReactNode
}

export function AdminShell({
  nav,
  title,
  actions,
  currentPath,
  LinkComponent,
  children,
}: AdminShellProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar items={nav} currentPath={currentPath} LinkComponent={LinkComponent} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} actions={actions} />
        <main className="flex-1 overflow-auto p-page">
          <div className="mx-auto flex max-w-content-max flex-col gap-section">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
