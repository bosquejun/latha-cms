import type { DateField as DateFieldConfig } from '@kon10/core'
import { DateTimePicker, Field as FieldWrap } from '@kon10/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

function toDateTimeValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' ? value : ''
}

export function DateField({
  field,
  id,
  value,
  onChange,
  onBlur,
  error,
}: FieldControlProps) {
  const dateField = field as DateFieldConfig
  return (
    <FieldWrap
      htmlFor={id}
      label={field.meta?.label ?? humanize(field.name)}
      required={field.required}
      description={field.meta?.description}
      error={error}
    >
      <DateTimePicker
        id={id}
        value={toDateTimeValue(value)}
        min={dateField.min}
        max={dateField.max}
        defaultDate={new Date()}
        onChange={onChange}
        onBlur={onBlur}
      />
    </FieldWrap>
  )
}
