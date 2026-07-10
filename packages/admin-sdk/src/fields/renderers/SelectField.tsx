import { cn, Field as FieldWrap, Select, statusVariant, type BadgeVariant } from '@kon10/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

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
 * are recognized statuses, each segment carries a colored status dot (amber
 * draft, green published, red failed…) while the active segment keeps the
 * neutral pill background, so the control
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
                    ? 'bg-background text-foreground shadow-xs'
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
