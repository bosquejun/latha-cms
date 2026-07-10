import { Field as FieldWrap, Input, Textarea } from '@kon10/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

/**
 * Fallback for field types without a dedicated renderer (media, relationship,
 * taxonomy, group, array). Scalar references render as a text input;
 * structured values render as a JSON textarea.
 */
export function FallbackField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error } = props
  const isStructured =
    field.type === 'group' ||
    field.type === 'array' ||
    ('many' in field && field.many)

  const label = field.meta?.label ?? humanize(field.name)

  if (!isStructured) {
    return (
      <FieldWrap
        htmlFor={id}
        label={label}
        required={field.required}
        description={field.meta?.description ?? `${field.type} reference`}
        error={error}
      >
        <Input
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      </FieldWrap>
    )
  }

  return (
    <FieldWrap
      htmlFor={id}
      label={label}
      required={field.required}
      description={`${field.type} · JSON`}
      error={error}
    >
      <Textarea
        id={id}
        className="font-mono text-xs"
        value={value == null ? '' : JSON.stringify(value, null, 2)}
        onChange={(e) => {
          try {
            onChange(e.target.value === '' ? null : JSON.parse(e.target.value))
          } catch {
            // Hold the raw string until it parses; surfaced on submit.
            onChange(e.target.value)
          }
        }}
        onBlur={onBlur}
      />
    </FieldWrap>
  )
}
