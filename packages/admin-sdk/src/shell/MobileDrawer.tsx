/**
 * MobileDrawer — scrim + slide-in panel wrapping the Sidebar nav (mobile).
 *
 * Behaves like a modal dialog on touch: Escape closes it, the page behind
 * stops scrolling while it's open, and the closed panel is `visibility:
 * hidden` (kept in the transition list so the slide-out finishes first) so
 * off-screen links can't be focused or read by assistive tech.
 */
import { useEffect, type ComponentType, type ReactNode } from 'react'
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
        className="invisible fixed bottom-0 left-0 top-(--header-height) z-[60] flex w-[280px] max-w-[85vw] -translate-x-full flex-col bg-sidebar pb-[env(safe-area-inset-bottom)] transition-[transform,visibility] duration-[220ms] [transition-timing-function:cubic-bezier(.4,0,.2,1)] data-[open=true]:visible data-[open=true]:translate-x-0 lg:hidden"
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
