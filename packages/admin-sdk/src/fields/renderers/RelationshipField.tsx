/**
 * `relationship` field renderer — a document picker for a core relationship.
 *
 * Fetches the target entity's descriptor (for `useAsTitle`) and its documents
 * in one pass, labeling each row by its title field. Single relationships use a
 * Select with a `(None)` sentinel; `many` relationships use `ManyDocPicker`
 * below — removable chips for the current selection, a filter once the list
 * gets long, and a bordered, scrollable checkbox list, mirroring
 * `@kon10/content`'s `TaxonomyField` so every `relationship()` field scales the
 * same way a taxonomy picker does. If the list read is denied (RBAC
 * deny-by-default), it degrades to a raw-id input so the field is still
 * editable — the server remains authoritative.
 */
import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Badge, Checkbox, cn, Field as FieldWrap, Input, Select, Spinner } from '@kon10/ui'
import { humanize } from '../../schema.js'
import { useKon10 } from '../../client/context.js'
import { useAsync } from '../../client/hooks.js'
import type { JsonDoc } from '../../client/rpc.js'
import type { FieldControlProps } from '../types.js'

const NONE = '__none__'

/**
 * Multi-select document picker: chips for the current selection (each
 * removable), a filter input once the list gets long, and a bordered
 * scrollable checkbox list so a big target entity never dominates the form.
 * Its own `useState` for the filter query is why this is a component rather
 * than an inline branch.
 */
function ManyDocPicker({
  docs,
  selected,
  optionLabel,
  onChange,
  onBlur,
  noun,
}: {
  docs: JsonDoc[]
  selected: string[]
  optionLabel: (doc: JsonDoc) => string
  onChange: (value: string[]) => void
  onBlur: () => void
  noun: string
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q ? docs.filter((d) => optionLabel(d).toLowerCase().includes(q)) : docs
  const labelOf = (id: string) => {
    const doc = docs.find((d) => d.id === id)
    return doc ? optionLabel(doc) : id
  }

  function commit(next: string[]) {
    onChange(next)
    onBlur()
  }

  if (docs.length === 0) {
    return <span className="text-caption text-muted-foreground">No {noun} to choose from.</span>
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((v) => (
            <Badge key={v} variant="secondary" className="gap-0.5 pr-1">
              {labelOf(v)}
              <button
                type="button"
                aria-label={`Remove ${labelOf(v)}`}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                onClick={() => commit(selected.filter((s) => s !== v))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {docs.length > 6 && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Filter ${noun}…`}
          className="h-8"
        />
      )}

      <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto rounded-md border border-input p-1.5">
        {filtered.length === 0 ? (
          <span className="px-1 py-1 text-caption text-muted-foreground">No matches.</span>
        ) : (
          filtered.map((doc) => (
            <label
              key={doc.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-small transition-colors hover:bg-accent/60',
              )}
            >
              <Checkbox
                checked={selected.includes(doc.id)}
                onChange={(e) =>
                  commit(
                    e.target.checked
                      ? [...selected, doc.id]
                      : selected.filter((s) => s !== doc.id),
                  )
                }
              />
              <span>{optionLabel(doc)}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

export function RelationshipField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const { client } = useKon10()
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
    control = (
      <ManyDocPicker
        docs={state.data?.docs ?? []}
        selected={selectedMany}
        optionLabel={optionLabel}
        onChange={onChange}
        onBlur={onBlur}
        noun={to}
      />
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
