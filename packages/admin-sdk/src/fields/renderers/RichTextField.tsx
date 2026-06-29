import { Field as FieldWrap } from '@latha/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'
import { LexicalEditor } from './lexical/LexicalEditor.js'

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
      <LexicalEditor
        id={id}
        value={typeof value === 'string' ? value : ''}
        onChange={onChange}
        onBlur={onBlur}
      />
    </FieldWrap>
  )
}
