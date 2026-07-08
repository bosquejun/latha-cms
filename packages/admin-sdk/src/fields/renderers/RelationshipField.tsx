/**
 * `relationship` field renderer — a document picker for a core relationship.
 *
 * Fetches the target entity's descriptor (for `useAsTitle`) and its documents
 * in one pass, labeling each row by its title field. Single relationships use a
 * Select with a `(None)` sentinel; `many` relationships use a checkbox list.
 * If the list read is denied (RBAC deny-by-default), it degrades to a raw-id
 * input so the field is still editable — the server remains authoritative.
 */
import type { ReactNode } from 'react'
import { Badge, Checkbox, Field as FieldWrap, Input, Select, Spinner } from '@latha/ui'
import { humanize } from '../../schema.js'
import { useLatha } from '../../client/context.js'
import { useAsync } from '../../client/hooks.js'
import type { JsonDoc } from '../../client/rpc.js'
import type { FieldControlProps } from '../types.js'

const NONE = '__none__'

export function RelationshipField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const { client } = useLatha()
  const to = String((field as Record<string, unknown>).to ?? '')
  const many = (field as Record<string, unknown>).many === true

  const state = useAsync(async () => {
    const [descriptor, docs] = await Promise.all([client.entity(to), client.list(to)])
    return { titleField: descriptor?.useAsTitle, docs }
  }, [to])

  const label = field.meta?.label ?? humanize(field.name)
  const titleField = state.data?.titleField
  const optionLabel = (doc: JsonDoc) =>
    String((titleField && doc[titleField]) ?? doc.id)

  const selectedMany: string[] = Array.isArray(value) ? (value as string[]) : []
  const selectedOne = typeof value === 'string' ? value : ''

  function toggle(docId: string, checked: boolean) {
    const next = checked
      ? [...selectedMany, docId]
      : selectedMany.filter((v) => v !== docId)
    onChange(next)
    onBlur()
  }

  let control: ReactNode
  if (state.loading) {
    control = <Spinner className="size-4" />
  } else if (state.error) {
    // RBAC denial or transport error — fall back to a raw id input.
    control = (
      <Input
        id={id}
        value={selectedOne}
        placeholder={`${to} id`}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    )
  } else if (many) {
    const docs = state.data?.docs ?? []
    control = (
      <div className="flex flex-col gap-2">
        {docs.length === 0 && (
          <span className="text-caption text-muted-foreground">No {to} to choose from.</span>
        )}
        {docs.map((doc) => (
          <label key={doc.id} className="flex items-center gap-2 text-small">
            <Checkbox
              checked={selectedMany.includes(doc.id)}
              onChange={(e) => toggle(doc.id, e.target.checked)}
            />
            <span>{optionLabel(doc)}</span>
          </label>
        ))}
        {selectedMany.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedMany.map((v) => {
              const doc = docs.find((d) => d.id === v)
              return (
                <Badge key={v} variant="secondary">
                  {doc ? optionLabel(doc) : v}
                </Badge>
              )
            })}
          </div>
        )}
      </div>
    )
  } else {
    const docs = state.data?.docs ?? []
    control = (
      <Select
        id={id}
        value={selectedOne}
        onValueChange={(v) => {
          // `null`, not `undefined` — the explicit "clear" sentinel that
          // survives JSON.stringify (see EntityForm's cleanValues).
          onChange(v === NONE ? null : v)
          onBlur()
        }}
        placeholder={`Select ${label.toLowerCase()}…`}
        options={[
          { label: '(None)', value: NONE },
          ...docs.map((doc) => ({ label: optionLabel(doc), value: doc.id })),
        ]}
      />
    )
  }

  return (
    <FieldWrap
      htmlFor={id}
      label={label}
      required={field.required}
      description={field.meta?.description}
      error={error}
    >
      {control}
    </FieldWrap>
  )
}
