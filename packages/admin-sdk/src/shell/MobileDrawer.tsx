/** MobileDrawer — scrim + slide-in panel wrapping the Sidebar nav (mobile). */
import type { ComponentType, ReactNode } from 'react'
import { Sidebar, type SidebarSection, type SidebarLinkProps } from './Sidebar.js'

export interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  sections: SidebarSection[]
  currentPath?: string
  LinkComponent?: ComponentType<SidebarLinkProps>
  showDashboard?: boolean
  header?: ReactNode
  footer?: ReactNode
}

export function MobileDrawer({
  open,
  onClose,
  sections,
  currentPath,
  LinkComponent,
  showDashboard,
  header,
  footer,
}: MobileDrawerProps) {
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
          sections={sections}
          currentPath={currentPath}
          LinkComponent={LinkComponent}
          onNavigate={onClose}
          showDashboard={showDashboard}
          header={header}
          footer={footer}
        />
      </div>
    </>
  )
}
