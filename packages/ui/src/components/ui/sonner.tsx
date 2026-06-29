import * as React from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Toaster — drop-in Sonner toaster wired to the Latha design tokens.
 * Mount once at the app root, then call `toast(...)` from anywhere.
 *
 * @example
 * // app root
 * import { Toaster } from '@latha/ui'
 * <Toaster />
 *
 * // anywhere in the tree
 * import { toast } from '@latha/ui'
 * toast.success('Saved')
 * toast.error('Something went wrong')
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'var(--popover)',
          '--success-text': 'var(--success)',
          '--success-border': 'var(--border)',
          '--error-bg': 'var(--popover)',
          '--error-text': 'var(--destructive)',
          '--error-border': 'var(--border)',
          '--warning-bg': 'var(--popover)',
          '--warning-text': 'var(--warning-foreground)',
          '--warning-border': 'var(--border)',
          '--font-family': 'var(--font-sans)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
