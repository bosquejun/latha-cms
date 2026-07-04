/**
 * EntityForm — the auto-generated form engine.
 *
 * Given a list of fields it builds a react-hook-form instance validated by
 * the Zod schema compiled from the same field definitions (`buildFormSchema`:
 * the registry-built document schema plus any `jsonSchema` refinements the
 * server shipped) via `@hookform/resolvers`' zodResolver — the single
 * validation layer, running on blur and on every change after a failed
 * submit. Each field renders through the renderer registry behind an RHF
 * `<Controller>`, so renderers stay form-library-agnostic.
 * Fields marked `field.meta?.sidebar` move to the 1/3 right panel; the rest
 * fill the main column. A sticky action bar floats below the topbar so Save
 * is always reachable regardless of form length.
 */

import { useMemo } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Field } from '@latha/core'
import { Button, toast } from '@latha/ui'
import { useId } from 'react'
import { buildFormSchema } from '../fields/formSchema.js'
import { getFieldRenderer } from '../fields/registry.js'
import { Slot } from '../extensions/Slot.js'
import { useExtensions } from '../extensions/context.js'
import { PageLayout } from '../shell/PageLayout.js'

type FormValues = Record<string, unknown>

export interface EntityFormProps {
  fields: Field[]
  initialValues?: FormValues
  submitLabel?: string
  onSubmit: (values: FormValues) => Promise<void> | void
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

function buildDefaults(fields: Field[], initial: FormValues | undefined): FormValues {
  const values: FormValues = {}
  for (const field of fields) {
    values[field.name] = initial?.[field.name] ?? defaultForField(field)
  }
  return values
}

/** Drop empty optional values so the schema can apply defaults / optionality. */
function cleanValues(fields: Field[], values: FormValues): FormValues {
  const out: FormValues = {}
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
  const defaults = useMemo(
    () => buildDefaults(fields, initialValues),
    [fields, initialValues],
  )

  // zodResolver validates the *cleaned* values (empty optionals dropped, as
  // the schema expects) and, on success, hands the parsed output — defaults
  // applied, dates coerced — to onSubmit.
  const resolver = useMemo<Resolver<FormValues>>(() => {
    const schema = buildFormSchema(fields)
    const base = zodResolver(schema as never) as unknown as Resolver<FormValues>
    return (values, context, options) =>
      base(cleanValues(fields, values), context, options)
  }, [fields])

  const {
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: defaults,
    resolver,
    mode: 'onBlur',
  })

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.')
    }
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
      <Controller
        key={field.name}
        control={control}
        name={field.name}
        render={({ field: rhf, fieldState }) => (
          <Renderer
            field={field}
            id={id}
            value={rhf.value}
            onChange={rhf.onChange}
            onBlur={rhf.onBlur}
            error={fieldState.error?.message}
          />
        )}
      />
    )
  }

  const hasSidebar = sidebarFields.length > 0 || hasSidebarSlots

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void submit()
      }}
    >
      {/* ── Sticky action bar ───────────────────────────────────────────────
          Stays pinned just below the fixed topbar so Save is always visible
          no matter how long the form is. Uses bg-background/95 + backdrop-blur
          so content scrolling underneath reads clearly.
      ──────────────────────────────────────────────────────────────────────── */}
      <div className="sticky top-(--header-height) z-10 mb-page-gap -mx-6 flex items-center gap-3 border-b border-border bg-background/95 px-6 py-2.5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          {isDirty ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-warning" />
              Unsaved changes
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-inline">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
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
