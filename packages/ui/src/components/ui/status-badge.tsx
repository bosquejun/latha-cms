import * as React from 'react'

import { cn } from '../../lib/utils.js'
import { Badge, type badgeVariants } from './badge.js'
import type { VariantProps } from 'class-variance-authority'

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

/**
 * Maps a content/entity status string to a semantic Badge color. Anything
 * unrecognized falls back to a neutral `secondary` badge.
 */
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  published: 'success',
  active: 'success',
  live: 'success',
  draft: 'warning',
  pending: 'warning',
  inactive: 'secondary',
  archived: 'secondary',
  error: 'destructive',
  failed: 'destructive',
}

/**
 * Semantic Badge color for a status string — the single source of truth
 * shared by `StatusBadge` and other status-aware controls. Unrecognized
 * statuses map to `secondary`.
 */
export function statusVariant(status: string): BadgeVariant {
  return STATUS_VARIANT[status.toLowerCase()] ?? 'secondary'
}

export interface StatusBadgeProps extends React.ComponentProps<'span'> {
  /** Content/entity status; mapped to a semantic Badge color. */
  status: string
}

/** Status string rendered as a color-coded, capitalized Badge. */
export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const variant = statusVariant(status)
  return (
    <Badge variant={variant} className={cn('capitalize', className)} {...props}>
      {status}
    </Badge>
  )
}
