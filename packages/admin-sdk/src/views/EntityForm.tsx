/**
 * EntityForm — the auto-generated form engine.
 *
 * Given a list of fields it builds a TanStack Form, renders each field through
 * the renderer registry, and validates with the Zod schema compiled from the
 * same field definitions (`buildZodSchema`) — the single validation layer.
 * Fields marked `admin.sidebar` move to the 1/3 sidebar; the rest fill the 2/3
 * main column.
 */

import { useForm } from '@tanstack/react-form'
import { buildZodSchema, type Field } from '@latha/core'
import { Button } from '@latha/ui'
import { useId, useMemo, useState } from 'react'
import { getFieldRenderer } from '../fields/registry.js'
import { Slot } from '../extensions/Slot.js'
import { useExtensions } from '../extensions/context.js'

export interface EntityFormProps {
  fields: Field[]
  initialValues?: Record<string, unknown>
  submitLabel?: string
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void
  onCancel?: () => void
  /** Entity descriptor, forwarded to `form.*` zone widgets as context. */
  entity?: unknown
  /** Record id on edit, forwarded to `form.*` zone widgets as context. */
  recordId?: string
}

function defaultForField(field: Field): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue
  switch (field.type) {
    case 'boolean':
      return false
    case 'number':
      return ''
    case 'array':
      return []
    case 'group':
      return {}
    default:
      return ''
  }
}

function buildDefaults(
  fields: Field[],
  initial: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    values[field.name] = initial?.[field.name] ?? defaultForField(field)
  }
  return values
}

/** Drop empty optional values so the schema can apply defaults / optionality. */
function cleanValues(
  fields: Field[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of fields) {
    const value = values[field.name]
    if (value === '' || (typeof value === 'number' && Number.isNaN(value))) {
      if (field.required) out[field.name] = value
      continue
    }
    out[field.name] = value
  }
  return out
}

export function EntityForm({
  fields,
  initialValues,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
  entity,
  recordId,
}: EntityFormProps) {
  const idPrefix = useId()
  const schema = useMemo(() => buildZodSchema(fields), [fields])
  const defaults = useMemo(
    () => buildDefaults(fields, initialValues),
    [fields, initialValues],
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: defaults,
    onSubmit: async ({ value }) => {
      const cleaned = cleanValues(fields, value)
      const result = schema.safeParse(cleaned)
      if (!result.success) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of result.error.issues) {
          const key = issue.path[0]
          if (key != null && !(String(key) in fieldErrors)) {
            fieldErrors[String(key)] = issue.message
          }
        }
        setErrors(fieldErrors)
        return
      }
      setErrors({})
      setFormError(null)
      try {
        await onSubmit(cleaned)
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    },
  })

  const mainFields = fields.filter((f) => !f.admin?.sidebar && !f.admin?.hidden)
  const sidebarFields = fields.filter((f) => f.admin?.sidebar && !f.admin?.hidden)

  const extensions = useExtensions()
  const hasSidebarSlots =
    extensions.widgetsForZone('form.sidebar.before').length > 0 ||
    extensions.widgetsForZone('form.sidebar.after').length > 0

  const renderField = (field: Field) => {
    const renderer = getFieldRenderer(field.type)
    const id = `${idPrefix}-${field.name}`
    return (
      <form.Field key={field.name} name={field.name}>
        {(api) =>
          renderer({
            field,
            id,
            value: api.state.value,
            onChange: (v) => api.handleChange(v as never),
            onBlur: api.handleBlur,
            error: errors[field.name],
          })
        }
      </form.Field>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
      className="grid grid-cols-1 gap-section lg:grid-cols-3"
    >
      <div className="flex flex-col gap-form lg:col-span-2">
        <Slot zone="form.before" entity={entity} recordId={recordId} className="flex flex-col gap-form" />
        {mainFields.map(renderField)}
        <Slot zone="form.after" entity={entity} recordId={recordId} className="flex flex-col gap-form" />
      </div>

      {(sidebarFields.length > 0 || hasSidebarSlots) && (
        <aside className="flex flex-col gap-form">
          <Slot zone="form.sidebar.before" entity={entity} recordId={recordId} className="flex flex-col gap-form" />
          {sidebarFields.map(renderField)}
          <Slot zone="form.sidebar.after" entity={entity} recordId={recordId} className="flex flex-col gap-form" />
        </aside>
      )}

      <div className="flex items-center gap-inline lg:col-span-3">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          )}
        </form.Subscribe>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {formError && (
          <span className="text-sm text-destructive">{formError}</span>
        )}
      </div>
    </form>
  )
}
