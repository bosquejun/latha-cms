import type { ReactNode } from 'react'
import { cn } from '@kon10/ui'

export type FieldHeadingLevel = 2 | 3 | 4 | 5 | 6

const TAG_BY_LEVEL: Record<FieldHeadingLevel, 'h2' | 'h3' | 'h4' | 'h5' | 'h6'> = {
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
}

export function nextHeadingLevel(level: FieldHeadingLevel): FieldHeadingLevel {
  return Math.min(level + 1, 6) as FieldHeadingLevel
}

export function FieldHeading({
  level = 2,
  className,
  children,
}: {
  level?: FieldHeadingLevel
  className?: string
  children: ReactNode
}) {
  const Heading = TAG_BY_LEVEL[level]
  return (
    <Heading
      className={cn(
        'font-semibold text-foreground',
        level === 2 ? 'text-h2' : level === 3 ? 'text-h3' : 'text-small',
        className,
      )}
    >
      {children}
    </Heading>
  )
}
