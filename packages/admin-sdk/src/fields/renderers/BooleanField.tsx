import { Label, Switch } from '@kon10/ui'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'

export function BooleanField({
  field,
  id,
  value,
  onChange,
  onBlur,
  error,
}: FieldControlProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="flex items-center gap-2.5 font-medium">
        <Switch
          id={id}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          onBlur={onBlur}
        />
        {field.meta?.label ?? humanize(field.name)}
      </Label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
