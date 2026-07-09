import type { ReactNode } from 'react'
import { Field as FieldWrap, Input, InputAddon, InputGroup, Textarea } from '@latha/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

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
  const isColor = field.meta?.inputType === 'color'
  // Multiline swaps the input for a textarea; prefix/suffix/color add-ons don't apply.
  const hasAddon = !field.meta?.multiline && !isColor && (prefix != null || suffix != null)
  const stringValue = typeof value === 'string' ? value : ''

  let control: ReactNode
  if (field.meta?.multiline) {
    control = (
      <Textarea
        id={id}
        value={stringValue}
        placeholder={field.meta?.placeholder}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    )
  } else if (isColor) {
    // A native `<input type="color">` swatch as the left add-on (rejects
    // anything but a valid 6-digit hex, so it falls back to white rather
    // than erroring while the hex text field holds a partial/invalid value)
    // plus a plain text input for typing the hex directly — instead of the
    // bare native color input, which is all picker and no visible/typeable
    // value.
    const swatchColor = HEX_COLOR.test(stringValue) ? stringValue : '#ffffff'
    control = (
      <InputGroup>
        <InputAddon className="p-0.5">
          <label
            className="relative block size-6 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-input focus-within:ring-2 focus-within:ring-ring/50"
            style={{ backgroundColor: swatchColor }}
          >
            <span className="sr-only">Pick a color</span>
            <input
              type="color"
              value={swatchColor}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </InputAddon>
        <Input
          id={id}
          type="text"
          value={stringValue}
          placeholder={field.meta?.placeholder ?? '#171717'}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="border-0 shadow-none focus-visible:ring-0"
        />
      </InputGroup>
    )
  } else {
    control = (
      <Input
        id={id}
        type={field.meta?.inputType ?? 'text'}
        value={stringValue}
        placeholder={field.meta?.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={hasAddon ? 'border-0 shadow-none focus-visible:ring-0' : undefined}
      />
    )
  }

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
          {control}
          {suffix != null && <InputAddon>{suffix}</InputAddon>}
        </InputGroup>
      ) : (
        control
      )}
    </FieldWrap>
  )
}
