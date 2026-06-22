/**
 * Topbar — page title + optional actions slot. Layout chrome only.
 *
 * Sticky and translucent: a backdrop-blurred bar so content scrolls softly
 * beneath it, matching the design system's header treatment.
 */

import type { ReactNode } from 'react'

export interface TopbarProps {
  title: ReactNode
  actions?: ReactNode
}

export function Topbar({ title, actions }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
