import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva('animate-spin shrink-0', {
  variants: {
    size: {
      sm: 'size-3',
      default: 'size-4',
      lg: 'size-5',
    },
  },
  defaultVariants: { size: 'default' },
})

export interface SpinnerProps
  extends Omit<React.ComponentProps<typeof Loader2>, 'size'>,
    VariantProps<typeof spinnerVariants> {}

function Spinner({ className, size, ...props }: SpinnerProps) {
  return (
    <Loader2
      data-slot="spinner"
      aria-label="Loading"
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    />
  )
}

export { Spinner, spinnerVariants }
