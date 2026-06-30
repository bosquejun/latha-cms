import { Field as FieldWrap, Input, InputAddon, InputGroup } from '@latha/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

export function TextField({
  field,
  id,
  value,
  onChange,
  onBlur,
  error,
}: FieldControlProps) {
  const prefix = field.meta?.prefix
  const suffix = field.meta?.suffix
  const hasAddon = prefix != null || suffix != null

  const input = (
    <Input
      id={id}
      type={field.meta?.inputType ?? 'text'}
      value={typeof value === 'string' ? value : ''}
      placeholder={field.meta?.placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={hasAddon ? 'border-0 shadow-none focus-visible:ring-0' : undefined}
    />
  )

  return (
    <FieldWrap
      htmlFor={id}
      label={field.meta?.label ?? humanize(field.name)}
      required={field.required}
      description={field.meta?.description}
      error={error}
    >
      {hasAddon ? (
        <InputGroup>
          {prefix != null && <InputAddon>{prefix}</InputAddon>}
          {input}
          {suffix != null && <InputAddon>{suffix}</InputAddon>}
        </InputGroup>
      ) : (
        input
      )}
    </FieldWrap>
  )
}
