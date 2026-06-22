import { Switch } from '@latha/ui'
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
      <label
        htmlFor={id}
        className="flex items-center gap-2.5 text-sm font-medium text-foreground"
      >
        <Switch
          id={id}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          onBlur={onBlur}
        />
        {field.admin?.label ?? humanize(field.name)}
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
