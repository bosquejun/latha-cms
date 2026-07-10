/**
 * `taxonomy` field renderer — a term picker for a content taxonomy.
 *
 * Lives in `@kon10/content/admin` (not the SDK) because the `taxonomy` field
 * type is owned by this module. Single taxonomies render a Select with the
 * term tree flattened + indented by depth; `many` taxonomies render the
 * `ManyTermPicker` below — removable chips for the current selection, a filter
 * for long lists, and a bordered, scrollable checkbox list. If the term list
 * read is denied (RBAC), it degrades to a raw-id input.
 */
import { useState, type ReactNode } from 'react'
import { Badge, Checkbox, cn, Field as FieldWrap, Input, Select, Spinner } from '@kon10/ui'
import {
  type FieldControlProps,
  humanize,
  useKon10,
  useAsync,
  type JsonDoc,
} from '@kon10/admin-sdk'
import { flattenTermTree, indentLabel } from '../../term-tree.js'

export const config = { type: 'taxonomy' }

const NONE = '__none__'

type FlatTerm = ReturnType<typeof flattenTermTree>[number]

/** Small × glyph for removable selection chips. Inlined to avoid an icon dep. */
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * Multi-select term picker: chips for the current selection (each removable),
 * a filter input once the list gets long, and a bordered scrollable checkbox
 * list so a big taxonomy never dominates the form. Its own `useState` for the
 * filter query is why this is a component rather than an inline branch.
 */
function ManyTermPicker({
  terms,
  selected,
  onChange,
  onBlur,
  noun,
}: {
  terms: FlatTerm[]
  selected: string[]
  onChange: (value: string[]) => void
  onBlur: () => void
  noun: string
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q ? terms.filter((t) => t.name.toLowerCase().includes(q)) : terms
  const nameOf = (id: string) => terms.find((t) => t.id === id)?.name ?? id

  function commit(next: string[]) {
    onChange(next)
    onBlur()
  }

  if (terms.length === 0) {
    return <span className="text-caption text-muted-foreground">No {noun} to choose from.</span>
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((v) => (
            <Badge key={v} variant="secondary" className="gap-0.5 pr-1">
              {nameOf(v)}
              <button
                type="button"
                aria-label={`Remove ${nameOf(v)}`}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                onClick={() => commit(selected.filter((s) => s !== v))}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {terms.length > 6 && (
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
          filtered.map((term) => (
            <label
              key={term.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-small transition-colors hover:bg-accent/60',
              )}
              style={{ paddingLeft: `${term.depth * 12 + 6}px` }}
            >
              <Checkbox
                checked={selected.includes(term.id)}
                onChange={(e) =>
                  commit(
                    e.target.checked
                      ? [...selected, term.id]
                      : selected.filter((s) => s !== term.id),
                  )
                }
              />
              <span>{term.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

export default function TaxonomyField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const { client } = useKon10()
  const to = String((field as Record<string, unknown>).to ?? '')
  const many = (field as Record<string, unknown>).many === true

  const terms = useAsync<JsonDoc[]>(() => client.list(to), [to])

  const label = field.meta?.label ?? humanize(field.name)
  const selectedMany: string[] = Array.isArray(value) ? (value as string[]) : []
  const selectedOne = typeof value === 'string' ? value : ''

  const flat = flattenTermTree((terms.data ?? []) as Parameters<typeof flattenTermTree>[0])

  let control: ReactNode
  if (terms.loading) {
    control = <Spinner className="size-4" />
  } else if (terms.error) {
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
      <ManyTermPicker
        terms={flat}
        selected={selectedMany}
        onChange={onChange}
        onBlur={onBlur}
        noun={to}
      />
    )
  } else {
    control = (
      <Select
        id={id}
        value={selectedOne}
        onValueChange={(v) => {
          onChange(v === NONE ? undefined : v)
          onBlur()
        }}
        placeholder={`Select ${label.toLowerCase()}…`}
        options={[
          { label: '(None)', value: NONE },
          ...flat.map((term) => ({ label: indentLabel(term), value: term.id })),
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
