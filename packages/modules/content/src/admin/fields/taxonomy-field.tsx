/**
 * `taxonomy` field renderer — a term picker for a content taxonomy.
 *
 * Lives in `@latha/content/admin` (not the SDK) because the `taxonomy` field
 * type is owned by this module. Single taxonomies render a Select with the
 * term tree flattened + indented by depth; `many` taxonomies render a checkbox
 * list. If the term list read is denied (RBAC), it degrades to a raw-id input.
 */
import type { ReactNode } from 'react'
import { Badge, Checkbox, Field as FieldWrap, Input, Select, Spinner } from '@latha/ui'
import { type FieldControlProps, humanize } from '@latha/admin-sdk'
import { useLatha, useAsync, type JsonDoc } from '@latha/start'
import { flattenTermTree, indentLabel } from '../../term-tree.js'

export const config = { type: 'taxonomy' }

const NONE = '__none__'

export default function TaxonomyField({ field, id, value, onChange, onBlur, error }: FieldControlProps) {
  const { client } = useLatha()
  const to = String((field as Record<string, unknown>).to ?? '')
  const many = (field as Record<string, unknown>).many === true

  const terms = useAsync<JsonDoc[]>(() => client.list(to), [to])

  const label = field.meta?.label ?? humanize(field.name)
  const selectedMany: string[] = Array.isArray(value) ? (value as string[]) : []
  const selectedOne = typeof value === 'string' ? value : ''

  function toggle(termId: string, checked: boolean) {
    onChange(checked ? [...selectedMany, termId] : selectedMany.filter((v) => v !== termId))
    onBlur()
  }

  const flat = flattenTermTree((terms.data ?? []) as Parameters<typeof flattenTermTree>[0])
  const nameOf = (termId: string) =>
    flat.find((t) => t.id === termId)?.name ?? termId

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
      <div className="flex flex-col gap-2">
        {flat.length === 0 && (
          <span className="text-caption text-muted-foreground">No {to} to choose from.</span>
        )}
        {flat.map((term) => (
          <label
            key={term.id}
            className="flex items-center gap-2 text-small"
            style={{ paddingLeft: `${term.depth * 12}px` }}
          >
            <Checkbox
              checked={selectedMany.includes(term.id)}
              onChange={(e) => toggle(term.id, e.target.checked)}
            />
            <span>{term.name}</span>
          </label>
        ))}
        {selectedMany.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedMany.map((v) => (
              <Badge key={v} variant="secondary">
                {nameOf(v)}
              </Badge>
            ))}
          </div>
        )}
      </div>
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
