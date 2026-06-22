/** MobileDrawer — scrim + slide-in panel wrapping the Sidebar nav (mobile). */
import type { ComponentType } from 'react'
import { Sidebar, type SidebarLinkProps } from './Sidebar.js'
import type { AdminNavItem } from '../schema.js'

export interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  items: AdminNavItem[]
  currentPath?: string
  LinkComponent?: ComponentType<SidebarLinkProps>
}

export function MobileDrawer({ open, onClose, items, currentPath, LinkComponent }: MobileDrawerProps) {
  return (
    <>
      <div
        onClick={onClose}
        data-open={open}
        className="fixed inset-0 z-50 bg-[oklch(0_0_0/0.4)] opacity-0 transition-opacity duration-200 data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 pointer-events-none"
      />
      <div
        data-open={open}
        className="fixed bottom-0 left-0 top-(--header-height) z-[60] flex w-[268px] max-w-[84vw] -translate-x-full flex-col bg-sidebar transition-transform duration-[220ms] [transition-timing-function:cubic-bezier(.4,0,.2,1)] data-[open=true]:translate-x-0"
      >
        <Sidebar
          items={items}
          currentPath={currentPath}
          LinkComponent={LinkComponent}
          onNavigate={onClose}
        />
      </div>
    </>
  )
}
