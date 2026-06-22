import * as React from 'react'

import { cn } from '@/lib/utils'
import { Badge, type badgeVariants } from './badge.js'
import type { VariantProps } from 'class-variance-authority'

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

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

export interface StatusBadgeProps extends React.ComponentProps<'span'> {
  /** Content/entity status; mapped to a semantic Badge color. */
  status: string
}

/** Status string rendered as a color-coded, capitalized Badge. */
export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const variant = STATUS_VARIANT[status.toLowerCase()] ?? 'secondary'
  return (
    <Badge variant={variant} className={cn('capitalize', className)} {...props}>
      {status}
    </Badge>
  )
}
