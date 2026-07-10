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
 * errors under `group.child`, but the Controller sits at `group`.
 *
 * Children pair into a two-up row wherever consecutive ones carry
 * `meta.width: 'half'` (see `layoutRows`) — the same rule `EntityForm` uses
 * for its main column, so a group's fields lay out consistently whether
 * they're nested or top-level. Pairing is computed separately within the
 * always-shown children and the `meta.advanced` ones (see below), so a
 * `'half'` field never pairs across that boundary.
 *
 * Children carrying `meta.advanced: true` start collapsed behind an
 * "Advanced options" accordion trigger beneath the always-shown ones,
 * instead of every child rendering up front — e.g. a color group that only
 * wants its base color shown by default, with the derived tokens available
 * on request. Plain `lucide-react` chevron, not `lucide-animated`'s: the
 * latter's `ChevronDownIcon` renders a fixed-size inner `<svg>` its own
 * `className` can't resize and animates a hover bob, not a rotation — wrong
 * tool for a click-driven expand/collapse indicator.
 */
import { useState } from 'react'
import { Card, CardContent, Separator, cn } from '@kon10/ui'
import { ChevronDown } from 'lucide-react'
import type { Field } from '@kon10/core'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'
import { getFieldRenderer } from '../registry.js'
import { layoutRows } from '../layout.js'
import { isFieldVisible } from '../show-if.js'

export function GroupField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const children: Field[] = Array.isArray((field as Record<string, unknown>).fields)
    ? ((field as Record<string, unknown>).fields as Field[])
    : []
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const [showAdvanced, setShowAdvanced] = useState(false)

  function setChild(name: string, next: unknown) {
    const merged = { ...obj }
    if (next === '' || next === undefined) delete merged[name]
    else merged[name] = next
    onChange(merged)
  }

  const label = field.meta?.label ?? humanize(field.name)
  const visibleChildren = children.filter((c) => isFieldVisible(c, obj))
  const primaryChildren = visibleChildren.filter((c) => !c.meta?.advanced)
  const advancedChildren = visibleChildren.filter((c) => c.meta?.advanced)

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

  const renderRows = (fields: Field[]) =>
    layoutRows(fields).map((row) => {
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
    })

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
      <Card className="gap-0 overflow-hidden">
        <CardContent className="flex flex-col gap-form">{renderRows(primaryChildren)}</CardContent>
        {advancedChildren.length > 0 && (
          <>
            <Separator className="mt-card" />
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className="flex w-full items-center justify-between px-card py-2.5 text-caption font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              Advanced options
              <ChevronDown
                className={cn('size-4 shrink-0 transition-transform duration-200', showAdvanced && 'rotate-180')}
              />
            </button>
            {showAdvanced && (
              <>
                <Separator />
                <CardContent className="flex flex-col gap-form pt-card">
                  {renderRows(advancedChildren)}
                </CardContent>
              </>
            )}
          </>
        )}
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
