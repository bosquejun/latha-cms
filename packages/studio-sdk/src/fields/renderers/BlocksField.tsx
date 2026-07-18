import { Badge, Button, Card, CardContent, Separator, cn } from '@kon10/ui'
import { ChevronDown, ChevronUp, GripVertical, Layers, Plus, Trash2, X } from 'lucide-react'
import type { Field } from 'kon10'
import { useState } from 'react'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'
import { getFieldRenderer } from '../registry.js'
import { sparseDefaults } from '../defaults.js'
import { layoutRows } from '../layout.js'
import { isFieldVisible } from '../show-if.js'
import { FieldHeading, nextHeadingLevel, type FieldHeadingLevel } from '../FieldHeading.js'

interface BlockDef {
  type: string
  label: string
  fields: Field[]
}

type BlockItem = Record<string, unknown> & { type: string }

/** Extract a short plain-text preview from the first text field of a block. */
function textPreview(def: BlockDef, item: BlockItem): string {
  const textField = def.fields.find((f) => f.type === 'text')
  if (!textField) return ''
  const val = item[textField.name]
  if (typeof val !== 'string' || !val) return ''
  return val.length > 72 ? val.slice(0, 72) + '…' : val
}

export function BlocksField({
  field,
  id,
  value,
  onChange,
  onBlur,
  error,
  headingLevel = 2,
}: FieldControlProps) {
  const items: BlockItem[] = Array.isArray(value) ? (value as BlockItem[]) : []
  const blockDefs: BlockDef[] = Array.isArray((field as Record<string, unknown>).blocks)
    ? ((field as Record<string, unknown>).blocks as BlockDef[])
    : []

  const [collapsedSet, setCollapsedSet] = useState<Set<number>>(new Set())
  const [showPicker, setShowPicker] = useState(false)

  const allCollapsed = items.length > 0 && collapsedSet.size === items.length

  function toggleCollapsed(index: number) {
    setCollapsedSet((prev: Set<number>) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleCollapseAll() {
    if (allCollapsed) {
      setCollapsedSet(new Set())
    } else {
      setCollapsedSet(new Set(items.map((_, i) => i)))
    }
  }

  function move(from: number, to: number) {
    const next = [...items]
    const item = next.splice(from, 1)[0]
    if (item === undefined) return
    next.splice(to, 0, item)

    // Remap collapsed indices to follow the moved block.
    setCollapsedSet((prev: Set<number>) => {
      const remapped = new Set<number>()
      for (const i of prev) {
        if (i === from) {
          remapped.add(to)
        } else if (from < to && i > from && i <= to) {
          remapped.add(i - 1)
        } else if (from > to && i >= to && i < from) {
          remapped.add(i + 1)
        } else {
          remapped.add(i)
        }
      }
      return remapped
    })

    onChange(next)
  }

  function remove(index: number) {
    setCollapsedSet((prev: Set<number>) => {
      const next = new Set<number>()
      for (const i of prev) {
        if (i < index) next.add(i)
        else if (i > index) next.add(i - 1)
      }
      return next
    })
    onChange(items.filter((_, i) => i !== index))
  }

  function addBlock(type: string) {
    const def = blockDefs.find((d) => d.type === type)
    if (!def) return
    const blank: BlockItem = { type, ...sparseDefaults(def.fields) }
    onChange([...items, blank])
    setShowPicker(false)
  }

  function updateField(blockIndex: number, fieldName: string, fieldValue: unknown) {
    onChange(
      items.map((item, i) =>
        i === blockIndex ? { ...item, [fieldName]: fieldValue } : item,
      ),
    )
  }

  const fieldLabel = field.meta?.label ?? humanize(field.name)

  return (
    <div className="flex flex-col gap-field">
      <div className="flex items-center gap-inline">
        <FieldHeading level={headingLevel}>
          {fieldLabel}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </FieldHeading>
        {items.length > 0 && (
          <span className="text-caption text-muted-foreground">
            {items.length} block{items.length !== 1 ? 's' : ''}
          </span>
        )}
        {items.length > 1 && (
          <button
            type="button"
            className="ml-auto min-h-tap text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline md:min-h-0"
            onClick={toggleCollapseAll}
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        )}
      </div>

      {items.length === 0 && blockDefs.length > 0 && !showPicker && (
        <div className="flex flex-col items-center gap-group rounded-lg border-2 border-dashed border-border py-10">
          <Layers className="h-8 w-8 text-muted-foreground/40" aria-hidden />
          <div className="text-center">
            <FieldHeading level={nextHeadingLevel(headingLevel)}>No blocks yet</FieldHeading>
            <p className="mt-0.5 text-caption text-muted-foreground">
              Add a block to start building this content area
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setShowPicker(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add block
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-group">
          {items.map((item, index) => {
            const def = blockDefs.find((d) => d.type === item.type)
            if (!def) return null
            const isCollapsed = collapsedSet.has(index)
            const preview = textPreview(def, item)

            return (
              <Card key={index} className="overflow-hidden py-0 gap-0">
                <div className="flex items-center gap-inline border-b border-border bg-muted/20 px-group py-inline">
                  {/* Drag handle (visual only) */}
                  <GripVertical
                    className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40"
                    aria-hidden
                  />

                  <FieldHeading level={nextHeadingLevel(headingLevel)} className="shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {def.label}
                    </Badge>
                  </FieldHeading>

                  {isCollapsed && preview && (
                    <span className="min-w-0 truncate text-sm text-muted-foreground">
                      {preview}
                    </span>
                  )}

                  <span className="ml-auto shrink-0 text-caption text-muted-foreground">
                    {index + 1}&thinsp;/&thinsp;{items.length}
                  </span>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      aria-label="Move up"
                      title="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label="Move down"
                      title="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Separator orientation="vertical" className="mx-1 h-5" />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="destructive-subtle"
                      onClick={() => remove(index)}
                      aria-label="Remove block"
                      title="Remove block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Separator orientation="vertical" className="mx-1 h-5" />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => toggleCollapsed(index)}
                      title={isCollapsed ? 'Expand block' : 'Collapse block'}
                      aria-expanded={!isCollapsed}
                    >
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-150',
                          isCollapsed && '-rotate-90',
                        )}
                      />
                    </Button>
                  </div>
                </div>

                {!isCollapsed && (
                  <BlockBody
                    def={def}
                    item={item}
                    fieldId={`${id}-${index}`}
                    onChangeField={(name, v) => updateField(index, name, v)}
                    onBlur={onBlur}
                    headingLevel={nextHeadingLevel(headingLevel)}
                  />
                )}
              </Card>
            )
          })}
        </div>
      )}

      {blockDefs.length > 0 && (
        <div>
          {showPicker ? (
            <div className="rounded-lg border border-border bg-muted/20 p-group">
              <div className="mb-2.5 flex items-center justify-between">
                <FieldHeading
                  level={nextHeadingLevel(headingLevel)}
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Choose block type
                </FieldHeading>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setShowPicker(false)}
                  aria-label="Close"
                  title="Close"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-inline">
                {blockDefs.map((d) => (
                  <Button
                    key={d.type}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addBlock(d.type)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            /* Only show the "Add block" button when there's already content or empty
               state isn't being shown (items.length === 0 case shows it in empty state) */
            items.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() => setShowPicker(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add block
              </Button>
            )
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

/**
 * Renders one block's fields with the same layout contract the rest of the form
 * honors: `meta.showIf` toggles visibility against sibling values, `meta.width:
 * 'half'` pairs consecutive fields into a two-up row that stacks below `sm`
 * (mobile-first), and `meta.advanced` children collapse behind an "Advanced
 * options" disclosure — mirroring `GroupField` so a field lays out the same
 * whether it sits at the top level, inside a `group()`, or inside a block.
 */
function BlockBody({
  def,
  item,
  fieldId,
  onChangeField,
  onBlur,
  headingLevel,
}: {
  def: BlockDef
  item: BlockItem
  fieldId: string
  onChangeField: (name: string, value: unknown) => void
  onBlur: () => void
  headingLevel: FieldHeadingLevel
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const visible = def.fields.filter((f) => isFieldVisible(f, item))
  const primary = visible.filter((f) => !f.meta?.advanced)
  const advanced = visible.filter((f) => f.meta?.advanced)

  const renderField = (f: Field) => {
    const Renderer = getFieldRenderer(f.type)
    return (
      <Renderer
        key={f.name}
        field={f}
        id={`${fieldId}-${f.name}`}
        value={item[f.name]}
        onChange={(v) => onChangeField(f.name, v)}
        onBlur={onBlur}
        error={undefined}
        headingLevel={headingLevel}
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
            {renderField(first)}
            {renderField(second)}
          </div>
        )
      }
      return renderField(row[0])
    })

  return (
    <CardContent className="flex flex-col gap-form pt-form">
      {renderRows(primary)}
      {advanced.length > 0 && (
        <>
          <Separator />
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="flex min-h-tap w-full items-center justify-between text-caption font-medium text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
          >
            Advanced options
            <ChevronDown
              className={cn(
                'size-4 shrink-0 transition-transform duration-200',
                showAdvanced && 'rotate-180',
              )}
            />
          </button>
          {showAdvanced && renderRows(advanced)}
        </>
      )}
    </CardContent>
  )
}
