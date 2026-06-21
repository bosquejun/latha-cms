import { Field as FieldWrap, Select } from '@latha/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

export function SelectField({
  field,
  id,
  value,
  onChange,
  error,
}: FieldControlProps) {
  const options =
    field.type === 'select'
      ? field.options.map((o) => ({ label: humanize(o), value: o }))
      : []

  return (
    <FieldWrap
      htmlFor={id}
      label={field.admin?.label ?? humanize(field.name)}
      required={field.required}
      description={field.admin?.description}
      error={error}
    >
      <Select
        id={id}
        options={options}
        placeholder={field.required ? 'Select…' : '—'}
        value={typeof value === 'string' ? value : ''}
        onValueChange={(v) => onChange(v)}
      />
    </FieldWrap>
  )
}
