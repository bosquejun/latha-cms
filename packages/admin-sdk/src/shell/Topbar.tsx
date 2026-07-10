/** Topbar — full-width sticky bar: burger + brand (left), slot (right). */
import type { ReactNode } from 'react'
import { Button } from '@kon10/ui'
import { Menu } from 'lucide-react'

export interface TopbarProps {
  brand?: string
  onMenuClick?: () => void
  children?: ReactNode
}

export function Topbar({ brand = 'Kon10', onMenuClick, children }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) items-center justify-between gap-group border-b border-border bg-background px-sidebar">
      <div className="flex min-w-0 items-center gap-inline">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onMenuClick}
          aria-label="Menu"
          className="lg:hidden pointer-coarse:min-h-11 pointer-coarse:min-w-11 [&_svg]:size-[18px]"
        >
          <Menu />
        </Button>
        <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-primary text-sm font-semibold text-primary-foreground">
          {brand.charAt(0).toUpperCase()}
        </span>
        {/* The wordmark yields to actions on phones — the logo mark keeps the
            bar branded, and the mobile drawer shows the full brand. */}
        <span className="truncate text-base font-semibold tracking-tight max-sm:hidden">
          {brand}
        </span>
      </div>
      {children}
    </header>
  )
}
