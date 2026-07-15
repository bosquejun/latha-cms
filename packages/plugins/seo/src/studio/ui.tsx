/**
 * Small presentational helpers shared by the `seo` and `socialGraph` field
 * renderers, so the two tabs read as one system. Lives outside `./fields/` so
 * the Studio barrel's `fields/**` glob never mistakes it for a field renderer.
 */
import type { ReactNode } from 'react'
import { Label, cn } from '@kon10/ui'

/** A soft "N / max" character counter that turns amber past the threshold. */
export function CharCounter({ length, max }: { length: number; max: number }) {
  return (
    <span
      className={cn(
        'text-caption tabular-nums',
        length > max ? 'text-warning' : 'text-muted-foreground',
      )}
    >
      {length} / {max}
    </span>
  )
}

/**
 * A label row (label left, optional `action` such as a counter right) above a
 * control, matching the Studio's own `Field` wrapper spacing so hand-rolled
 * inputs line up with the composed `media`/`select` renderers beside them.
 */
export function LabeledField({
  htmlFor,
  label,
  action,
  description,
  children,
}: {
  htmlFor?: string
  label: string
  action?: ReactNode
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-field">
      <div className="flex items-center justify-between gap-inline">
        <Label htmlFor={htmlFor}>{label}</Label>
        {action}
      </div>
      {children}
      {description && <p className="text-caption text-muted-foreground">{description}</p>}
    </div>
  )
}
