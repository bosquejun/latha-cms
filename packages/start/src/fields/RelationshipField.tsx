/**
 * Relationship field renderer (client-aware).
 *
 * `@latha/admin-sdk` field renderers are framework-agnostic and receive only
 * value/onChange — they can't fetch data. A relationship needs the target
 * collection's records to offer as options, so this renderer lives in
 * `@latha/start` where it can use the RPC client. It's registered into the SDK
 * renderer registry (see `admin.tsx`), so any `relationship` field — including
 * any `many` relationship field — gets a real picker.
 *
 * Single relationships render as a `Select`; `many` relationships render as a
 * checkbox list. Option labels use the target entity's `useAsTitle`.
 */

import { Checkbox, Field as FieldWrap, Select } from '@latha/ui'
import { humanize, type FieldControlProps, useLatha, useAsync } from '@latha/admin-sdk'

export function RelationshipField({
  field,
  id,
  value,
  onChange,
  error,
}: FieldControlProps) {
  const { client } = useLatha()
  const to = field.type === 'relationship' ? field.to : ''
  const many = field.type === 'relationship' ? field.many === true : false

  const entity = useAsync(
    () => (to ? client.entity(to) : Promise.resolve(null)),
    [to],
  )
  const rows = useAsync(() => (to ? client.list(to) : Promise.resolve([])), [to])

  const label = field.admin?.label ?? humanize(field.name)
  const titleField = entity.data?.useAsTitle

  const optionLabelFor = (row: Record<string, unknown>): string => {
    const raw = titleField ? row[titleField] : undefined
    return typeof raw === 'string' && raw.length > 0 ? raw : String(row.id)
  }

  const options = (rows.data ?? []).map((row) => ({
    label: optionLabelFor(row),
    value: String(row.id),
  }))

  const control = () => {
    if (rows.loading || entity.loading) {
      return (
        <p className="text-small text-muted-foreground">Loading options…</p>
      )
    }
    if (options.length === 0) {
      return (
        <p className="text-small text-muted-foreground">
          No {to} to choose from.
        </p>
      )
    }

    if (many) {
      const selected = Array.isArray(value) ? (value as string[]) : []
      const toggle = (v: string) =>
        onChange(
          selected.includes(v)
            ? selected.filter((x) => x !== v)
            : [...selected, v],
        )
      return (
        <div className="flex flex-col gap-field rounded-md border border-input p-3">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 text-small"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )
    }

    return (
      <Select
        id={id}
        options={options}
        placeholder={field.required ? 'Select…' : '—'}
        value={typeof value === 'string' ? value : ''}
        onValueChange={(v) => onChange(v)}
      />
    )
  }

  return (
    <FieldWrap
      htmlFor={id}
      label={label}
      required={field.required}
      description={field.admin?.description}
      error={error}
    >
      {control()}
    </FieldWrap>
  )
}
