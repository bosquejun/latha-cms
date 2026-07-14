import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../../lib/utils.js'
import { Spinner } from './spinner.js'

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all touch-manipulation disabled:pointer-events-none disabled:opacity-50 md:min-h-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        // Low-emphasis destructive: the standard treatment for inline delete /
        // remove actions (table rows, form toolbars). Solid `destructive` is
        // reserved for the confirming button inside a dialog.
        'destructive-subtle':
          'text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/20 dark:hover:bg-destructive/20 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      // Mobile-first 44px targets stay usable in browser device emulation and
      // hybrid hardware where pointer media queries are unreliable. Desktop
      // density returns at `md`; min-* survives compact caller overrides.
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3 md:h-9',
        sm: 'h-10 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 md:h-8',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4 md:h-10',
        icon: 'size-10 min-w-10 md:size-9 md:min-w-0',
        // Compact icon button for dense contexts (table rows, card headers).
        'icon-sm': 'size-10 min-w-10 rounded-md md:size-8 md:min-w-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Show a spinner and block interaction while true. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? children : (
        <>
          {loading && <Spinner size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'default'} />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
