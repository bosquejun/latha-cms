import {
  Select as SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.js'
import { cn } from '../lib/utils.js'

export interface SelectOption {
  label: string
  value: string
}

export interface SelectInputProps {
  id?: string
  value?: string
  onValueChange?: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * A convenience wrapper around the shadcn Select composite that exposes a
 * simple `options` + `value` + `onValueChange` API. Radix Select items require
 * non-empty values, so an empty/unset value is represented via the placeholder.
 */
export function SelectInput({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
}: SelectInputProps) {
  return (
    <SelectRoot
      value={value ? value : undefined}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder ?? 'Select…'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  )
}
