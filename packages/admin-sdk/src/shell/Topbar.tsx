/**
 * Topbar — page title + optional actions slot. Layout chrome only.
 */

import type { ReactNode } from 'react'

export interface TopbarProps {
  title: ReactNode
  actions?: ReactNode
}

export function Topbar({ title, actions }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
