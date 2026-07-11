import * as React from 'react'
import { cn } from '../../lib/utils.js'

/**
 * InputGroup — a flex wrapper that visually merges an Input with left/right
 * add-ons into a single connected field. Owns the border and focus ring so
 * the inner Input should suppress its own (`border-0 shadow-none
 * focus-visible:ring-0`). Use InputAddon for text/icon slots.
 *
 * @example
 * <InputGroup>
 *   <InputAddon>https://</InputAddon>
 *   <Input className="border-0 shadow-none focus-visible:ring-0" />
 *   <InputAddon><CopyButton value={url} /></InputAddon>
 * </InputGroup>
 */
function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        'flex items-stretch rounded-md border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 has-[[aria-invalid]]:border-destructive has-[[aria-invalid]]:ring-destructive/20',
        className,
      )}
      {...props}
    />
  )
}

/**
 * InputAddon — a non-interactive (or interactive) slot attached to the left
 * or right of an Input inside an InputGroup. Automatically uses `first:` /
 * `last:` selectors to round the correct corners and draw the inner divider.
 */
function InputAddon({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="input-addon"
      className={cn(
        'flex shrink-0 items-center bg-muted px-3 text-sm text-muted-foreground first:rounded-l-[calc(theme(borderRadius.md)-1px)] first:border-r last:rounded-r-[calc(theme(borderRadius.md)-1px)] last:border-l border-input [&:has([data-slot=button])]:px-1',
        className,
      )}
      {...props}
    />
  )
}

export { InputGroup, InputAddon }
