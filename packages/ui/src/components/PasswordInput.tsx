import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../lib/utils.js'
import { Input } from './ui/input.js'
import { InputGroup, InputAddon } from './ui/input-group.js'

export interface PasswordInputProps
  extends Omit<React.ComponentProps<'input'>, 'type'> {}

/**
 * PasswordInput — a text input with a show/hide eye-toggle button. Wraps
 * Input inside an InputGroup so the toggle sits flush inside the field border.
 */
function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <InputGroup className={className}>
      <Input
        type={visible ? 'text' : 'password'}
        className="border-0 shadow-none focus-visible:ring-0"
        {...props}
      />
      <InputAddon>
        <button
          type="button"
          data-slot="eye-toggle"
          aria-label={visible ? 'Hide password' : 'Show password'}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </InputAddon>
    </InputGroup>
  )
}

export { PasswordInput }
