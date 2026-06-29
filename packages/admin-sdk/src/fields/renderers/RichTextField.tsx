import { Field as FieldWrap, Textarea } from '@latha/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

/**
 * Phase 3 richtext renderer — a plain multiline textarea. A real rich-text
 * editor can be swapped in later without touching the registry contract.
 */
export function RichTextField({
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
      <Textarea
        id={id}
        value={typeof value === 'string' ? value : ''}
        placeholder={field.meta?.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </FieldWrap>
  )
}
