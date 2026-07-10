/**
 * PageLayout — standard page-level panel grid.
 *
 * Renders a responsive 1-, 2-, or 3-pane layout depending on which optional
 * panels are provided. Mobile-first: panels stack vertically by default and
 * arrange side-by-side at the `lg:` breakpoint.
 *
 * Panel widths are driven by CSS custom properties:
 *   --panel-left  (default 17.5rem)  left secondary panel (nav, lists)
 *   --panel-right (default 20rem)    right sidebar (metadata, actions)
 */

import { type ReactNode } from 'react'
import { cn } from '@kon10/ui'

export interface PageLayoutProps {
  /** Left secondary panel — navigation, item lists, filter trees. */
  left?: ReactNode
  /** Right sidebar panel — metadata, publish controls, actions. */
  right?: ReactNode
  /** Primary content area. Always rendered. */
  children: ReactNode
  className?: string
}

export function PageLayout({ left, right, children, className }: PageLayoutProps) {
  const hasLeft = Boolean(left)
  const hasRight = Boolean(right)
  const hasPanels = hasLeft || hasRight

  return (
    <div
      className={cn(
        'flex flex-col gap-section',
        hasPanels && 'lg:grid lg:items-start',
        hasLeft && hasRight && 'lg:grid-cols-[var(--panel-left)_1fr_var(--panel-right)]',
        hasLeft && !hasRight && 'lg:grid-cols-[var(--panel-left)_1fr]',
        !hasLeft && hasRight && 'lg:grid-cols-[1fr_var(--panel-right)]',
        className,
      )}
    >
      {hasLeft && <div className="min-w-0">{left}</div>}
      <div className="min-w-0">{children}</div>
      {hasRight && <div className="min-w-0">{right}</div>}
    </div>
  )
}
