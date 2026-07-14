import type { ReactNode } from 'react'
import { cn, Field as FieldWrap, Input, InputAddon, InputGroup, Textarea } from '@kon10/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'
import { HEX_COLOR, shadesOf } from '../color.js'

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
    // A native `<input type="color">` swatch (rejects anything but a valid
    // 6-digit hex, so it falls back to white rather than erroring while the
    // hex text field holds a partial/invalid value) as its own button, next
    // to — not fused with — a plain text input for typing the hex directly.
    // Kept as two separate controls rather than one bordered InputGroup:
    // InputGroup's addon slot is built for static text/icon labels, and a
    // real interactive picker crammed into it reads as broken chrome rather
    // than part of the field.
    const swatchColor = HEX_COLOR.test(stringValue) ? stringValue : '#ffffff'
    // Only a genuinely valid current value has shades worth showing — a
    // partial/empty one has nothing to derive from (shadesOf returns []).
    const shades = field.meta?.shades ? shadesOf(stringValue) : []
    control = (
      <div className="flex flex-col gap-inline">
        <div className="flex items-center gap-inline">
          <label
            className="relative block size-10 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 md:size-9"
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
          <Input
            id={id}
            type="text"
            value={stringValue}
            placeholder={field.meta?.placeholder ?? '#171717'}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            className="flex-1"
          />
        </div>
        {shades.length > 0 && (
          <div className="grid grid-cols-5 gap-tight sm:grid-cols-9" role="group" aria-label="Primary color shades">
            {shades.map((shade) => (
              <button
                key={shade.step}
                type="button"
                title={`${shade.step}: ${shade.hex}${shade.isBase ? ' (base)' : ''}`}
                aria-label={`Use shade ${shade.step}, ${shade.hex}${shade.isBase ? ', current base color' : ''}`}
                onClick={() => onChange(shade.hex)}
                className={cn(
                  'flex min-h-10 cursor-pointer flex-col overflow-hidden rounded-md border border-input bg-background text-[10px] font-medium text-muted-foreground outline-none transition-transform hover:-translate-y-0.5 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  shade.isBase && 'border-ring ring-2 ring-ring/40',
                )}
              >
                <span className="h-6 w-full" style={{ backgroundColor: shade.hex }} />
                <span className="flex flex-1 items-center">{shade.step}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
