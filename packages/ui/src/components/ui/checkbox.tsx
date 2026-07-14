import * as React from 'react'
import { Check } from 'lucide-react'

import { cn } from '../../lib/utils.js'

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
        'relative inline-flex size-tap shrink-0 items-center justify-center md:size-4',
        disabled && 'opacity-50',
        className,
      )}
    >
      <input
        type="checkbox"
        disabled={disabled}
        className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0 outline-none disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none size-4 rounded-[4px] border border-input bg-background shadow-2xs transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50"
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
