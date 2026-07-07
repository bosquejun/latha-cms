/**
 * `array` field renderer — a repeatable fieldset.
 *
 * The value is an array of plain objects, one per item; each item renders its
 * child fields through the registry (`getFieldRenderer`), the same recursion
 * `GroupField` uses. Items can be added, removed, and reordered with
 * move-up/down controls (no drag dependency). Setting a child to an empty
 * value drops the key, mirroring `GroupField`/`cleanValues`.
 *
 * Like `group`, errors surface at the array level only — per-item plumbing is
 * a follow-up alongside group's.
 */
import { Button, Card, CardContent } from '@latha/ui'
import type { Field } from '@latha/core'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'
import { getFieldRenderer } from '../registry.js'

export function ArrayField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const children: Field[] = Array.isArray((field as Record<string, unknown>).fields)
    ? ((field as Record<string, unknown>).fields as Field[])
    : []
  const items: Record<string, unknown>[] = Array.isArray(value)
    ? (value as Record<string, unknown>[])
    : []

  const label = field.meta?.label ?? humanize(field.name)
  const itemLabel = label.replace(/s$/i, '') || 'item'

  function setItem(index: number, name: string, next: unknown) {
    const merged = { ...items[index] }
    if (next === '' || next === undefined) delete merged[name]
    else merged[name] = next
    onChange(items.map((item, i) => (i === index ? merged : item)))
  }

  function addItem() {
    onChange([...items, {}])
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index)
    onChange(next.length === 0 ? undefined : next)
  }

  function moveItem(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-field">
      <div className="flex items-center justify-between gap-inline">
        <p className="text-sm font-medium">
          {label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          Add {itemLabel.toLowerCase()}
        </Button>
      </div>
      {field.meta?.description && (
        <p className="text-caption text-muted-foreground">{field.meta.description}</p>
      )}
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
          No {label.toLowerCase()} yet.
        </p>
      ) : (
        items.map((item, index) => (
          <Card key={index}>
            <CardContent className="flex flex-col gap-form">
              <div className="flex items-center justify-between">
                <p className="text-caption font-medium text-muted-foreground">
                  {humanize(itemLabel)} {index + 1}
                </p>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Move down"
                    disabled={index === items.length - 1}
                    onClick={() => moveItem(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeItem(index)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              {children.map((child) => {
                const Renderer = getFieldRenderer(child.type)
                return (
                  <Renderer
                    key={child.name}
                    field={child}
                    id={`${id}-${index}-${child.name}`}
                    value={item[child.name]}
                    onChange={(v) => setItem(index, child.name, v)}
                    onBlur={onBlur}
                    error={undefined}
                  />
                )
              })}
            </CardContent>
          </Card>
        ))
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
