import { Field as FieldWrap, Input } from '@latha/ui'
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
  return (
    <FieldWrap
      htmlFor={id}
      label={field.admin?.label ?? humanize(field.name)}
      required={field.required}
      description={field.admin?.description}
      error={error}
    >
      <Input
        id={id}
        value={typeof value === 'string' ? value : ''}
        placeholder={field.admin?.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </FieldWrap>
  )
}
