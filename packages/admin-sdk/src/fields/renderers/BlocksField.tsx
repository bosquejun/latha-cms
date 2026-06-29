import { Badge, Button, Card, CardContent, CardHeader, Separator } from '@latha/ui'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import type { Field } from '@latha/core'
import { humanize } from '../../schema.js'
import type { FieldControlProps } from '../types.js'
import { getFieldRenderer } from '../registry.js'

interface BlockDef {
  type: string
  label: string
  fields: Field[]
}

type BlockItem = Record<string, unknown> & { type: string }

function defaultForField(field: Field): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue
  switch (field.type as string) {
    case 'boolean':
      return false
    case 'number':
      return ''
    case 'array':
    case 'blocks':
      return []
    case 'group':
      return {}
    default:
      return ''
  }
}

export function BlocksField({
  field,
  id,
  value,
  onChange,
  onBlur,
  error,
}: FieldControlProps) {
  const items: BlockItem[] = Array.isArray(value) ? (value as BlockItem[]) : []
  const blockDefs: BlockDef[] = Array.isArray((field as Record<string, unknown>).blocks)
    ? ((field as Record<string, unknown>).blocks as BlockDef[])
    : []

  function move(from: number, to: number) {
    const next = [...items]
    const item = next.splice(from, 1)[0]
    if (item === undefined) return
    next.splice(to, 0, item)
    onChange(next)
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function addBlock(type: string) {
    const def = blockDefs.find((d) => d.type === type)
    if (!def) return
    const blank: BlockItem = { type }
    for (const f of def.fields) {
      blank[f.name] = defaultForField(f)
    }
    onChange([...items, blank])
  }

  function updateField(blockIndex: number, fieldName: string, fieldValue: unknown) {
    onChange(
      items.map((item, i) =>
        i === blockIndex ? { ...item, [fieldName]: fieldValue } : item,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-field">
      {field.meta?.label !== undefined || field.name ? (
        <p className="text-sm font-medium">
          {field.meta?.label ?? humanize(field.name)}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </p>
      ) : null}

      {items.length > 0 && (
        <div className="flex flex-col gap-field">
          {items.map((item, index) => {
            const def = blockDefs.find((d) => d.type === item.type)
            if (!def) return null
            return (
              <Card key={index}>
                <CardHeader className="flex-row items-center gap-inline py-2 border-b">
                  <Badge variant="secondary" className="shrink-0">
                    {def.label}
                  </Badge>
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      title="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, index + 1)}
                      title="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Separator orientation="vertical" className="mx-1 h-5" />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => remove(index)}
                      title="Remove block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-form pt-form">
                  {def.fields.map((f) => {
                    const renderer = getFieldRenderer(f.type)
                    return renderer({
                      field: f,
                      id: `${id}-${index}-${f.name}`,
                      value: item[f.name],
                      onChange: (v) => updateField(index, f.name, v),
                      onBlur,
                      error: undefined,
                    })
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {blockDefs.length > 0 && (
        <div className="flex items-center gap-inline">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            defaultValue=""
            onChange={(e) => {
              const type = e.currentTarget.value
              if (!type) return
              addBlock(type)
              e.currentTarget.value = ''
            }}
          >
            <option value="">Add block…</option>
            {blockDefs.map((d) => (
              <option key={d.type} value={d.type}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
