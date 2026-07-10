/**
 * WidgetLayout — compact panel grid for use inside cards and widgets.
 *
 * Structurally identical to PageLayout but uses card-level spacing and
 * narrower default panel widths, making it suitable for sub-layouts within
 * a single Card rather than a full page section.
 */

import { type ReactNode } from 'react'
import { cn } from '@kon10/ui'

export interface WidgetLayoutProps {
  /** Left auxiliary panel. */
  left?: ReactNode
  /** Right auxiliary panel. */
  right?: ReactNode
  /** Primary content area. */
  children: ReactNode
  className?: string
}

export function WidgetLayout({ left, right, children, className }: WidgetLayoutProps) {
  const hasLeft = Boolean(left)
  const hasRight = Boolean(right)
  const hasPanels = hasLeft || hasRight

  return (
    <div
      className={cn(
        'flex flex-col gap-card-gap',
        hasPanels && 'lg:grid lg:items-start',
        hasLeft && hasRight && 'lg:grid-cols-[12rem_1fr_14rem]',
        hasLeft && !hasRight && 'lg:grid-cols-[12rem_1fr]',
        !hasLeft && hasRight && 'lg:grid-cols-[1fr_14rem]',
        className,
      )}
    >
      {hasLeft && <div className="min-w-0">{left}</div>}
      <div className="min-w-0">{children}</div>
      {hasRight && <div className="min-w-0">{right}</div>}
    </div>
  )
}
