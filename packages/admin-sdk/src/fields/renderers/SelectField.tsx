import { cn, Field as FieldWrap, Select, statusVariant, type BadgeVariant } from '@latha/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

/** Active-segment classes per semantic status variant (badge palette). */
const ACTIVE_BY_VARIANT: Record<BadgeVariant, string> = {
  success: 'bg-success/15 text-success shadow-xs',
  warning: 'bg-warning/20 text-warning-foreground shadow-xs',
  destructive: 'bg-destructive/15 text-destructive shadow-xs',
  secondary: 'bg-background text-foreground shadow-xs',
  default: 'bg-background text-foreground shadow-xs',
  outline: 'bg-background text-foreground shadow-xs',
}

/** Status dot color per semantic variant. */
const DOT_BY_VARIANT: Record<BadgeVariant, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  secondary: 'bg-muted-foreground/50',
  default: 'bg-muted-foreground/50',
  outline: 'bg-muted-foreground/50',
}

/**
 * A small, always-set enum (≤ 4 options and either required or defaulted, e.g.
 * a draft/published status) renders as a full-width segmented control rather
 * than a dropdown — one tap to switch, all choices visible. When the options
 * are recognized statuses, each segment carries its semantic badge color (a
 * colored dot, and the active segment tinted green/amber/red), so the control
 * reads as a status badge you can toggle. Larger sets, or optional selects that
 * need a "none" state, keep the dropdown (which owns the `—` placeholder /
 * clearing a segmented control can't express).
 */
export function SelectField({
  field,
  id,
  value,
  onChange,
  error,
}: FieldControlProps) {
  const options =
    field.type === 'select'
      ? field.options.map((o) => ({ label: humanize(o), value: o }))
      : []

  const current = typeof value === 'string' ? value : ''
  const segmented =
    options.length > 0 &&
    options.length <= 4 &&
    (field.required || field.defaultValue != null)
  // Colored (badge) treatment only when at least one option is a known status
  // word — a plain enum stays a neutral toggle.
  const statusLike = segmented && options.some((o) => statusVariant(o.value) !== 'secondary')

  return (
    <FieldWrap
      htmlFor={id}
      label={field.meta?.label ?? humanize(field.name)}
      required={field.required}
      description={field.meta?.description}
      error={error}
    >
      {segmented ? (
        <div
          role="radiogroup"
          aria-label={field.meta?.label ?? humanize(field.name)}
          className="flex w-full items-center gap-1 rounded-md bg-muted p-1"
        >
          {options.map((o) => {
            const active = current === o.value
            const variant = statusVariant(o.value)
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(o.value)}
                className={cn(
                  'inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  active
                    ? ACTIVE_BY_VARIANT[variant]
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {statusLike && (
                  <span className={cn('size-1.5 shrink-0 rounded-full', DOT_BY_VARIANT[variant])} />
                )}
                {o.label}
              </button>
            )
          })}
        </div>
      ) : (
        <Select
          id={id}
          options={options}
          placeholder={field.required ? 'Select…' : '—'}
          value={current}
          onValueChange={(v) => onChange(v)}
        />
      )}
    </FieldWrap>
  )
}
