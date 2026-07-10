/**
 * StudioShell — full-width topbar over a (sidebar + content) row.
 * Owns the mobile drawer open state. Data-agnostic: pages render their own
 * PageHeader inside `children`. Scattered `<Slot>`s expose the shell's chrome
 * (topbar ends, sidebar top/bottom, main before/after) to extensions.
 */
import { useState, type ComponentType, type ReactNode } from 'react'
import { Toaster } from '@kon10/ui'
import { Sidebar, type SidebarSection, type SidebarLinkProps } from './Sidebar.js'
import { Topbar } from './Topbar.js'
import { MobileDrawer } from './MobileDrawer.js'
import { Slot } from '../extensions/Slot.js'

export interface StudioShellProps {
  /** Sidebar sections (entity groups + extension groups), in display order. */
  sections: SidebarSection[]
  currentPath?: string
  LinkComponent?: ComponentType<SidebarLinkProps>
  brand?: string
  userMenu?: ReactNode
  children: ReactNode
  /** Render the fixed Dashboard entry in the sidebar. Default true. */
  showDashboard?: boolean
  /** Pinned to the top of the sidebar (e.g. a back button). */
  sidebarHeader?: ReactNode
  /** Pinned to the bottom of the sidebar (e.g. a Settings button). */
  sidebarFooter?: ReactNode
}

export function StudioShell({
  sections,
  currentPath,
  LinkComponent,
  brand = 'Kon10',
  userMenu,
  children,
  showDashboard = true,
  sidebarHeader,
  sidebarFooter,
}: StudioShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Topbar brand={brand} onMenuClick={() => setDrawerOpen(true)}>
        <div className="flex items-center gap-group">
          <Slot zone="shell.topbar.start" className="flex items-center gap-inline" />
          {userMenu}
          <Slot zone="shell.topbar.end" className="flex items-center gap-inline" />
        </div>
      </Topbar>
      <div className="flex min-h-0 flex-1">
        {/* Persistent sidebar from `lg` (1024px) up: tablet landscape and
            desktop. Below that — phones and tablet portrait — navigation
            moves into the drawer, matching PageLayout's `lg:` panel split. */}
        <aside className="sticky top-(--header-height) h-[calc(100dvh-var(--header-height))] max-lg:hidden">
          <Sidebar
            sections={sections}
            currentPath={currentPath}
            LinkComponent={LinkComponent}
            showDashboard={showDashboard}
            header={sidebarHeader}
            footer={sidebarFooter}
          />
        </aside>
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          brand={brand}
          sections={sections}
          currentPath={currentPath}
          LinkComponent={LinkComponent}
          showDashboard={showDashboard}
          header={sidebarHeader}
          footer={sidebarFooter}
        />
        <main className="min-w-0 flex-1 p-page [--container-px:var(--space-page)]">
          <div className="mx-auto w-full max-w-content-max">
            <Slot zone="shell.main.before" />
            {children}
            <Slot zone="shell.main.after" />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  )
}
