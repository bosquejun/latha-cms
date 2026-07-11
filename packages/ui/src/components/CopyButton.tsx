import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '../lib/utils.js'

export interface CopyButtonProps extends React.ComponentProps<'button'> {
  value: string
  /** Milliseconds to show the check before reverting. Default: 1500. */
  resetDelay?: number
}

/**
 * CopyButton — an icon button that copies `value` to the clipboard and shows
 * a momentary check confirmation. Designed to sit inside an InputAddon or
 * standalone next to an input.
 */
function CopyButton({
  value,
  resetDelay = 1500,
  className,
  onClick,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(e)
    if (e.defaultPrevented) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), resetDelay)
    } catch {
      // clipboard not available in insecure contexts
    }
  }

  return (
    <button
      type="button"
      data-slot="copy-button"
      aria-label={copied ? 'Copied' : 'Copy'}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  )
}

export { CopyButton }
