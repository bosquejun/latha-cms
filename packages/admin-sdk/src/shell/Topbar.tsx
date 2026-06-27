/** Topbar — full-width sticky bar: burger + brand (left), slot (right). */
import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'

export interface TopbarProps {
  brand?: string
  onMenuClick?: () => void
  children?: ReactNode
}

export function Topbar({ brand = 'LathaCMS', onMenuClick, children }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-(--header-height) items-center justify-between gap-group border-b border-border bg-background px-sidebar">
      <div className="flex min-w-0 items-center gap-inline">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Menu"
          className="grid size-9 place-items-center rounded-md border border-border bg-background text-foreground max-[860px]:inline-grid min-[861px]:hidden [&_svg]:size-[18px]"
        >
          <Menu />
        </button>
        <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-primary text-sm font-semibold text-primary-foreground">
          {brand.charAt(0).toUpperCase()}
        </span>
        <span className="text-base font-semibold tracking-tight">{brand}</span>
      </div>
      {children}
    </header>
  )
}
