import * as React from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface CheckboxProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'size'> {}

/**
 * Checkbox — a native checkbox styled to the design system (no extra deps).
 * The real `<input>` drives the box + check via the `peer` pattern.
 */
function Checkbox({ className, disabled, ...props }: CheckboxProps) {
  return (
    <span
      data-slot="checkbox"
      className={cn(
        'relative inline-flex size-4 shrink-0 items-center justify-center',
        disabled && 'opacity-50',
        className,
      )}
    >
      <input
        type="checkbox"
        disabled={disabled}
        className="peer size-4 cursor-pointer appearance-none rounded-[4px] border border-input bg-background shadow-2xs outline-none transition-colors checked:border-primary checked:bg-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
        {...props}
      />
      <Check
        aria-hidden
        className="pointer-events-none absolute size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
        strokeWidth={3}
      />
    </span>
  )
}

export { Checkbox }
