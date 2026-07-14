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
        'relative inline-flex size-tap shrink-0 cursor-pointer items-center justify-center md:h-[1.15rem] md:w-8',
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
        className="pointer-events-none relative h-[1.15rem] w-8 rounded-full bg-input shadow-xs transition-colors after:absolute after:left-0.5 after:top-1/2 after:size-3.5 after:-translate-y-1/2 after:rounded-full after:bg-background after:shadow-xs after:transition-transform after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-[0.85rem] peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50"
      />
    </label>
  )
}

export { Switch }
