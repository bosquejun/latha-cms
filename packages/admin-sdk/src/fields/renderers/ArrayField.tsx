/**
 * `array` field renderer — a repeatable fieldset.
 *
 * The value is an array of plain objects, one per item; each item renders its
 * child fields through the registry (`getFieldRenderer`), the same recursion
 * `GroupField` uses. Items can be added, removed, and reordered with
 * move-up/down controls (no drag dependency). Setting a child to an empty
 * value drops the key, mirroring `GroupField`/`cleanValues`.
 *
 * Each item collapses independently (local UI state — not persisted, not
 * form data) so a long list stays navigable; the header shows the item's
 * `useAsTitle` child value when the field declares one and the item has it
 * set, falling back to the numbered "Item 1" label otherwise. Collapse state
 * is tracked by index and kept in sync with `items` across add/remove/move,
 * the same operations already applied to the value array itself.
 *
 * Like `group`, errors surface at the array level only, not per-item.
 */
import { useState } from 'react'
import { Button, Card, CardContent, cn } from '@kon10/ui'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import type { Field } from '@kon10/core'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'
import { getFieldRenderer } from '../registry.js'
import { isFieldVisible } from '../show-if.js'
import { sparseDefaults } from '../defaults.js'

export function ArrayField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const children: Field[] = Array.isArray((field as Record<string, unknown>).fields)
    ? ((field as Record<string, unknown>).fields as Field[])
    : []
  const items: Record<string, unknown>[] = Array.isArray(value)
    ? (value as Record<string, unknown>[])
    : []
  const useAsTitle =
    typeof (field as Record<string, unknown>).useAsTitle === 'string'
      ? ((field as Record<string, unknown>).useAsTitle as string)
      : undefined

  const label = field.meta?.label ?? humanize(field.name)
  const itemLabel = label.replace(/s$/i, '') || 'item'

  const [collapsed, setCollapsed] = useState<boolean[]>([])
  const isCollapsed = (index: number) => collapsed[index] ?? false

  function toggleCollapsed(index: number) {
    setCollapsed((prev) => {
      const next = [...prev]
      next[index] = !(prev[index] ?? false)
      return next
    })
  }

  function itemTitle(item: Record<string, unknown>, index: number): string {
    const raw = useAsTitle ? item[useAsTitle] : undefined
    if (typeof raw === 'string' && raw.trim()) return raw
    return `${humanize(itemLabel)} ${index + 1}`
  }

  function setItem(index: number, name: string, next: unknown) {
    const merged = { ...items[index] }
    if (next === '' || next === undefined) delete merged[name]
    else merged[name] = next
    onChange(items.map((item, i) => (i === index ? merged : item)))
  }

  function addItem() {
    onChange([...items, sparseDefaults(children)])
    setCollapsed((prev) => [...prev, false])
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index)
    onChange(next.length === 0 ? undefined : next)
    setCollapsed((prev) => prev.filter((_, i) => i !== index))
  }

  function moveItem(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
    setCollapsed((prev) => {
      const nextCollapsed = [...prev]
      ;[nextCollapsed[index], nextCollapsed[target]] = [nextCollapsed[target]!, nextCollapsed[index]!]
      return nextCollapsed
    })
  }

  return (
    <div className="flex flex-col gap-field">
      <div className="flex items-center justify-between gap-inline">
        <p className="text-sm font-medium">
          {label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          <Plus /> Add {itemLabel.toLowerCase()}
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
        items.map((item, index) => {
          const itemCollapsed = isCollapsed(index)
          return (
            <Card key={index} className={cn(itemCollapsed && 'py-3')}>
              <CardContent className="flex flex-col gap-form">
                <div className="flex items-center justify-between gap-inline">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(index)}
                    aria-expanded={!itemCollapsed}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn(
                        'size-3.5 shrink-0 transition-transform duration-150',
                        itemCollapsed && '-rotate-90',
                      )}
                    />
                    <span className="truncate">{itemTitle(item, index)}</span>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Move up"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => moveItem(index, -1)}
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Move down"
                      title="Move down"
                      disabled={index === items.length - 1}
                      onClick={() => moveItem(index, 1)}
                    >
                      <ChevronDown />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="destructive-subtle"
                      aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                      title="Remove"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                {!itemCollapsed &&
                  children
                    .filter((child) => isFieldVisible(child, item))
                    .map((child) => {
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
          )
        })
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
