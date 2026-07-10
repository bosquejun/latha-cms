import { Field as FieldWrap, Input } from '@kon10/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

function toDateInput(value: unknown): string {
  if (typeof value !== 'string' || value === '') return ''
  // Accept ISO strings; keep just the date portion for <input type=date>.
  return value.slice(0, 10)
}

export function DateField({
  field,
  id,
  value,
  onChange,
  onBlur,
  error,
}: FieldControlProps) {
  return (
    <FieldWrap
      htmlFor={id}
      label={field.meta?.label ?? humanize(field.name)}
      required={field.required}
      description={field.meta?.description}
      error={error}
    >
      <Input
        id={id}
        type="date"
        value={toDateInput(value)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </FieldWrap>
  )
}
