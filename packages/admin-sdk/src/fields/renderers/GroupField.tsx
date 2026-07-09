/**
 * `group` field renderer — a nested fieldset.
 *
 * Recurses through the registry (`getFieldRenderer`) for each child field, the
 * same composition pattern `BlocksField` uses. The group's value is a plain
 * object keyed by child name; setting a child to an empty value drops the key
 * (mirroring the top-level `cleanValues` behavior) so untouched optional
 * subfields stay absent rather than persisting `''`.
 *
 * Errors surface only at the group level — react-hook-form nests subfield
 * errors under `group.child`, but the Controller sits at `group`. Acceptable
 * while group subfields are optional; per-child error plumbing is a follow-up.
 *
 * Children pair into a two-up row wherever consecutive ones carry
 * `meta.width: 'half'` (see `layoutRows`) — the same rule `EntityForm` uses
 * for its main column, so a group's fields lay out consistently whether
 * they're nested or top-level.
 */
import { Card, CardContent } from '@latha/ui'
import type { Field } from '@latha/core'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'
import { getFieldRenderer } from '../registry.js'
import { layoutRows } from '../layout.js'

export function GroupField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const children: Field[] = Array.isArray((field as Record<string, unknown>).fields)
    ? ((field as Record<string, unknown>).fields as Field[])
    : []
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>

  function setChild(name: string, next: unknown) {
    const merged = { ...obj }
    if (next === '' || next === undefined) delete merged[name]
    else merged[name] = next
    onChange(merged)
  }

  const label = field.meta?.label ?? humanize(field.name)

  const renderChild = (child: Field) => {
    const Renderer = getFieldRenderer(child.type)
    return (
      <Renderer
        key={child.name}
        field={child}
        id={`${id}-${child.name}`}
        value={obj[child.name]}
        onChange={(v) => setChild(child.name, v)}
        onBlur={onBlur}
        error={undefined}
      />
    )
  }

  return (
    <div className="flex flex-col gap-field">
      <div className="flex items-center gap-inline">
        <p className="text-sm font-medium">
          {label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </p>
      </div>
      {field.meta?.description && (
        <p className="text-caption text-muted-foreground">{field.meta.description}</p>
      )}
      <Card>
        <CardContent className="flex flex-col gap-form">
          {layoutRows(children).map((row) => {
            if (row.length === 2) {
              const [first, second] = row
              return (
                <div
                  key={`${first.name}+${second.name}`}
                  className="grid grid-cols-2 gap-form max-sm:grid-cols-1"
                >
                  {renderChild(first)}
                  {renderChild(second)}
                </div>
              )
            }
            return renderChild(row[0])
          })}
        </CardContent>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
