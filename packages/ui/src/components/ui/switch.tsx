import * as React from 'react'

import { cn } from '../../lib/utils.js'

export interface SwitchProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'size'> {
  /** Class applied to the outer track wrapper. */
  className?: string
}

/**
 * Switch — an accessible toggle built on a native checkbox (no extra deps).
 * The real `<input>` is visually hidden but drives the styled track + thumb via
 * the `peer` pattern, so it stays keyboard- and form-friendly.
 */
function Switch({ className, disabled, ...props }: SwitchProps) {
  return (
    <label
      data-slot="switch"
      className={cn(
        'relative inline-flex h-[1.15rem] w-8 shrink-0 cursor-pointer items-center',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-0.5 size-3.5 rounded-full bg-background shadow-xs transition-transform peer-checked:translate-x-[0.85rem]"
      />
    </label>
  )
}

export { Switch }
