/**
 * MobileDrawer — scrim + slide-in panel wrapping the Sidebar nav (mobile).
 *
 * Overlays the full viewport height — including the topbar — like a native
 * mobile nav sheet, so it carries its own header (brand + close button).
 * Behaves like a modal dialog on touch: Escape closes it, the page behind
 * stops scrolling while it's open, and the closed panel is `visibility:
 * hidden` (kept in the transition list so the slide-out finishes first) so
 * off-screen links can't be focused or read by assistive tech.
 */
import { useEffect, type ComponentType, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@kon10/ui'
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
  brand?: string
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
  brand = 'Kon10',
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
        className="invisible fixed inset-y-0 left-0 z-[60] flex w-[280px] max-w-[85vw] -translate-x-full flex-col bg-sidebar pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] transition-[transform,visibility] duration-[220ms] [transition-timing-function:cubic-bezier(.4,0,.2,1)] data-[open=true]:visible data-[open=true]:translate-x-0 lg:hidden"
      >
        {/* Drawer header — mirrors the topbar brand, plus a close button. */}
        <div className="flex h-(--header-height) shrink-0 items-center justify-between gap-inline border-b border-sidebar-border px-sidebar">
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
        <Sidebar
          sections={sections}
          currentPath={currentPath}
          LinkComponent={LinkComponent}
          onNavigate={onClose}
          showDashboard={showDashboard}
          header={header}
          footer={footer}
          className="w-full min-h-0 flex-1 border-r-0"
        />
      </div>
    </>
  )
}
