/**
 * MainTopNav — the topmost bar of the top-nav shell: burger (below lg) +
 * brand mark + wordmark on the left, actions/user menu (passed as children)
 * on the right. Sits on the nav surface; SecondaryTopNav docks directly
 * beneath it.
 */
import type { ReactNode } from 'react'
import { Button } from '@kon10/ui'
import { Menu } from 'lucide-react'

export interface MainTopNavProps {
  brand?: string
  /** Brand logo element for the mark; falls back to a lettermark from `brand`. */
  logo?: ReactNode
  onMenuClick?: () => void
  children?: ReactNode
}

export function MainTopNav({ brand = 'Kon10', logo, onMenuClick, children }: MainTopNavProps) {
  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) items-center justify-between gap-group border-b border-nav-border bg-nav px-nav text-nav-foreground">
      <div className="flex min-w-0 items-center gap-inline">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onMenuClick}
          aria-label="Menu"
          data-studio-menu-trigger=""
          className="lg:hidden pointer-coarse:min-h-10 pointer-coarse:min-w-10 [&_svg]:size-[18px]"
        >
          <Menu />
        </Button>
        {logo ? (
          <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)] [&_img]:size-full [&_svg]:size-full">
            {logo}
          </span>
        ) : (
          <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-primary text-sm font-semibold text-primary-foreground">
            {brand.charAt(0).toUpperCase()}
          </span>
        )}
        {/* The wordmark yields to actions on phones — the logo mark keeps the
            bar branded, and the mobile menu shows the full brand. */}
        <span className="truncate text-base font-semibold tracking-tight max-sm:hidden">
          {brand}
        </span>
      </div>
      {children}
    </header>
  )
}
