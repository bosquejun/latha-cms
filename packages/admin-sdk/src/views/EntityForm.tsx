/**
 * EntityForm — the auto-generated form engine.
 *
 * Given a list of fields it builds a TanStack Form, renders each field through
 * the renderer registry, and validates with the Zod schema compiled from the
 * same field definitions (`buildZodSchema`) — the single validation layer.
 * Fields marked `field.meta?.sidebar` move to the 1/3 right panel; the rest
 * fill the main column. A sticky action bar floats below the topbar so Save
 * is always reachable regardless of form length.
 */

import { useForm } from '@tanstack/react-form'
import { buildZodSchema, type Field } from '@latha/core'
import { Button } from '@latha/ui'
import { useId, useMemo, useState } from 'react'
import { getFieldRenderer } from '../fields/registry.js'
import { Slot } from '../extensions/Slot.js'
import { useExtensions } from '../extensions/context.js'
import { PageLayout } from '../shell/PageLayout.js'

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

  const mainFields = fields.filter((f) => !f.meta?.sidebar && !f.meta?.hidden)
  const sidebarFields = fields.filter((f) => f.meta?.sidebar && !f.meta?.hidden)

  const extensions = useExtensions()
  const hasSidebarSlots =
    extensions.widgetsForZone('form.sidebar.before').length > 0 ||
    extensions.widgetsForZone('form.sidebar.after').length > 0

  const renderField = (field: Field) => {
    const Renderer = getFieldRenderer(field.type)
    const id = `${idPrefix}-${field.name}`
    return (
      <form.Field key={field.name} name={field.name}>
        {(api) => (
          <Renderer
            field={field}
            id={id}
            value={api.state.value}
            onChange={(v) => api.handleChange(v as never)}
            onBlur={api.handleBlur}
            error={errors[field.name]}
          />
        )}
      </form.Field>
    )
  }

  const hasSidebar = sidebarFields.length > 0 || hasSidebarSlots

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
    >
      {/* ── Sticky action bar ───────────────────────────────────────────────
          Stays pinned just below the fixed topbar so Save is always visible
          no matter how long the form is. Uses bg-background/95 + backdrop-blur
          so content scrolling underneath reads clearly.
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-(--header-height) z-10 mb-page-gap -mx-6 flex items-center gap-3 border-b border-border bg-background/95 px-6 py-2.5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          {formError ? (
            <span className="text-sm text-destructive">{formError}</span>
          ) : (
            <form.Subscribe selector={(s) => s.isDirty}>
              {(isDirty) =>
                isDirty ? (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-warning" />
                    Unsaved changes
                  </span>
                ) : null
              }
            </form.Subscribe>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-inline">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : submitLabel}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </div>

      <PageLayout
        right={
          hasSidebar ? (
            <aside className="flex flex-col gap-form">
              <Slot
                zone="form.sidebar.before"
                entity={entity}
                recordId={recordId}
                className="flex flex-col gap-form"
              />
              {sidebarFields.map(renderField)}
              <Slot
                zone="form.sidebar.after"
                entity={entity}
                recordId={recordId}
                className="flex flex-col gap-form"
              />
            </aside>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-form">
          <Slot
            zone="form.before"
            entity={entity}
            recordId={recordId}
            className="flex flex-col gap-form"
          />
          {mainFields.map(renderField)}
          <Slot
            zone="form.after"
            entity={entity}
            recordId={recordId}
            className="flex flex-col gap-form"
          />
        </div>
      </PageLayout>
    </form>
  )
}
