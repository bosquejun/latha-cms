import { Field as FieldWrap, Input } from '@kon10/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

export function NumberField({
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
        type="number"
        value={value === '' || value == null ? '' : Number(value)}
        onChange={(e) =>
          onChange(e.target.value === '' ? '' : e.target.valueAsNumber)
        }
        onBlur={onBlur}
      />
    </FieldWrap>
  )
}
