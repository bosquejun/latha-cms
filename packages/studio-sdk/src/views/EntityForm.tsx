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
 * Fields marked `field.meta?.sidebar` move to the right panel; the rest
 * fill the main column. A sticky toolbar floats below the topbar so the
 * section tabs, the unsaved-changes status, and Save stay reachable
 * regardless of form length.
 *
 * When any main-column field carries a `field.meta?.group`, the main column
 * splits into tabs — one per distinct group, in the order groups first appear,
 * with ungrouped fields collected into a leading "General" tab. The tab strip
 * lives on the left of the sticky toolbar (status + actions sit on the right);
 * each panel renders in the main column below. All tab panels stay mounted
 * (inactive ones hidden) so react-hook-form never unregisters a field just
 * because its tab isn't visible, and each tab shows a badge counting its fields
 * with validation errors so problems on a hidden tab stay visible. With no
 * groups declared, the main column renders flat with no tab strip.
 *
 * Within a tab (or the flat main column), a main-column field carrying
 * `field.meta?.width === 'half'` pairs with the next `'half'` field into a
 * two-up row (see `layoutRows`); both stack full-width below `sm`.
 */

import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Field } from '@kon10/core'
import { Button, Tabs, toast } from '@kon10/ui'
import { Trash2 } from 'lucide-react'
import { useId } from 'react'
import { buildFormSchema } from '../fields/formSchema.js'
import { FormValuesProvider, type FormValuesStore } from '../fields/form-values.js'
import { getFieldRenderer } from '../fields/registry.js'
import { layoutRows } from '../fields/layout.js'
import { isFieldVisible } from '../fields/show-if.js'
import { defaultForField } from '../fields/defaults.js'
import { Slot } from '../extensions/Slot.js'
import { useExtensions } from '../extensions/context.js'
import { PageLayout } from '../shell/PageLayout.js'

type FormValues = Record<string, unknown>

/** Label for the implicit tab that collects fields with no `meta.group`. */
const DEFAULT_GROUP = 'General'

interface FieldGroup {
  key: string
  label: string
  fields: Field[]
}

/**
 * Partition main-column fields into ordered groups keyed by `meta.group`.
 * Groups appear in the order their first field is encountered; ungrouped fields
 * collect into a leading "General" group. Returns a single group (rendered flat
 * by the caller) when no field declares a `meta.group`.
 */
function groupFields(fields: Field[]): FieldGroup[] {
  const order: string[] = []
  const byKey = new Map<string, FieldGroup>()
  for (const field of fields) {
    const label = field.meta?.group ?? DEFAULT_GROUP
    let group = byKey.get(label)
    if (!group) {
      group = { key: label, label, fields: [] }
      byKey.set(label, group)
      order.push(label)
    }
    group.fields.push(field)
  }
  return order.map((label) => byKey.get(label)!)
}

export interface EntityFormProps {
  fields: Field[]
  initialValues?: FormValues
  submitLabel?: string
  onSubmit: (values: FormValues) => Promise<void> | void
  onCancel?: () => void
  /**
   * Destructive action for the record (edit view). When provided, a subtle
   * Delete button appears in the toolbar, separated from Cancel/Save. The
   * caller owns confirmation and navigation; omit it to hide the button (e.g.
   * on create, or when the user lacks delete permission).
   */
  onDelete?: () => Promise<void> | void
  /** Entity descriptor, forwarded to `form.*` zone widgets as context. */
  entity?: unknown
  /** Record id on edit, forwarded to `form.*` zone widgets as context. */
  recordId?: string
}

function buildDefaults(fields: Field[], initial: FormValues | undefined): FormValues {
  const values: FormValues = {}
  for (const field of fields) {
    values[field.name] = initial?.[field.name] ?? defaultForField(field)
  }
  return values
}

/**
 * Normalize empty optional values to `null` — the explicit "clear this
 * field" sentinel (see the registry's `nullable()` wrapping) — rather than
 * dropping the key. Dropping would mean "untouched", which is wrong: the
 * writer emptied the field on purpose. Required fields keep their empty
 * value so the schema surfaces the "required" error instead of silently
 * clearing.
 */
function cleanValues(fields: Field[], values: FormValues): FormValues {
  const out: FormValues = {}
  for (const field of fields) {
    const value = values[field.name]
    if (value === '' || (typeof value === 'number' && Number.isNaN(value))) {
      out[field.name] = field.required ? value : null
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
  onDelete,
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
    watch,
    getValues,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: defaults,
    resolver,
    mode: 'onBlur',
  })

  // Adapt the RHF instance into the library-agnostic FormValuesStore so
  // renderers can watch sibling fields via useFieldValue without ever
  // touching react-hook-form.
  const valuesStore = useMemo<FormValuesStore>(
    () => ({
      getValues,
      subscribe: (listener) => {
        const subscription = watch(listener)
        return () => subscription.unsubscribe()
      },
    }),
    [watch, getValues],
  )

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.')
    }
  })

  // Reactive snapshot of all top-level values, purely so `meta.showIf` fields
  // can hide/show as their referenced sibling changes.
  const watchedValues = (useWatch({ control }) ?? {}) as FormValues
  const visibleFields = fields.filter((f) => isFieldVisible(f, watchedValues))
  const mainFields = visibleFields.filter((f) => !f.meta?.sidebar && !f.meta?.hidden)
  const sidebarFields = visibleFields.filter((f) => f.meta?.sidebar && !f.meta?.hidden)

  // Split the main column into tab groups. A single group means no field
  // declared `meta.group`, so we render flat with no tab strip.
  const groups = useMemo(() => groupFields(mainFields), [mainFields])
  const tabbed = groups.length > 1
  const [activeTab, setActiveTab] = useState(groups[0]?.key)
  const active = groups.some((g) => g.key === activeTab) ? activeTab : groups[0]?.key

  // Scope by entity slug so a widget declared for another entity (e.g. a
  // posts-only tips panel) doesn't make every form reserve an empty sidebar.
  const entitySlug = (entity as { slug?: string } | undefined)?.slug
  const extensions = useExtensions()
  const hasSidebarSlots =
    extensions.widgetsForZone('form.sidebar.before', entitySlug).length > 0 ||
    extensions.widgetsForZone('form.sidebar.after', entitySlug).length > 0

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

  const renderFieldRows = (fieldsToRender: Field[]) =>
    layoutRows(fieldsToRender).map((row) => {
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

  const hasSidebar = sidebarFields.length > 0 || hasSidebarSlots

  return (
    <FormValuesProvider store={valuesStore}>
      {/* Width is a page concern, not the form's: the host page (see
          `useFormWidth`) wraps the header AND this form in the narrow
          container so title, toolbar, and fields center as one unit. */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void submit()
        }}
      >
        {/* ── Sticky toolbar ──────────────────────────────────────────────────
            Pinned just below the fixed topbar so it's always reachable no
            matter how long the form is. One row does double duty: the section
            tabs sit on the left (filling what was otherwise dead space), and
            the unsaved-changes status + actions sit on the right. Uses
            bg-background/95 + backdrop-blur so content scrolling underneath
            reads clearly. `bleed-x` + `px-(--container-px)` track the page
            gutter (which shrinks on mobile) instead of hardcoding 24px.

            On phones the row splits into two tidy stacked rows: actions
            first (right-aligned, matching the mobile app-bar convention),
            then the tabs stretched into a full-width segmented control that
            sits directly above the panels it switches. From `sm` up both
            share one row — tabs left, actions right.
        ──────────────────────────────────────────────────────────────────────── */}
        <div className="bleed-x sticky top-[var(--shell-top,var(--header-height))] z-10 mb-page-gap flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-border bg-background/95 px-(--container-px) py-2.5 backdrop-blur-sm max-sm:-mt-2 max-sm:py-2">
          {tabbed ? (
            <Tabs
              className="max-w-full max-sm:order-last max-sm:w-full max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center"
              items={groups.map((group) => {
                const errorCount = group.fields.filter((f) => errors[f.name]).length
                return {
                  value: group.key,
                  label: (
                    <span className="flex items-center gap-1.5">
                      {group.label}
                      {errorCount > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                          {errorCount}
                        </span>
                      )}
                    </span>
                  ),
                }
              })}
              value={active}
              onValueChange={setActiveTab}
            />
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-inline max-sm:w-full max-sm:justify-end">
            {onDelete && (
              <>
                <Button
                  type="button"
                  variant="destructive-subtle"
                  size="sm"
                  onClick={() => void onDelete()}
                >
                  <Trash2 /> Delete
                </Button>
                <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
              </>
            )}
            {isDirty ? (
              <span
                className="mr-1 flex items-center gap-1.5 text-sm text-muted-foreground"
                title="Unsaved changes"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-warning" />
                {/* On phones the amber dot alone signals dirty state. */}
                <span className="max-sm:sr-only">Unsaved changes</span>
              </span>
            ) : null}
            {onCancel && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {/* On an existing record (edit view, `recordId` set) there's nothing
                to save until something changes, so Save stays disabled while the
                form is pristine. Create/singleton forms keep Save always enabled. */}
            <Button
              type="submit"
              size="sm"
              loading={isSubmitting}
              disabled={isSubmitting || (recordId != null && !isDirty)}
            >
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
            {tabbed
              ? groups.map((group) => (
                  // The tab strip lives in the sticky toolbar; here we render one
                  // panel per group. Panels stay mounted (inactive ones hidden) so
                  // react-hook-form keeps every field registered and validated
                  // across tabs.
                  <div
                    key={group.key}
                    role="tabpanel"
                    hidden={group.key !== active}
                    className="flex flex-col gap-form"
                  >
                    {renderFieldRows(group.fields)}
                  </div>
                ))
              : renderFieldRows(mainFields)}
            <Slot
              zone="form.after"
              entity={entity}
              recordId={recordId}
              className="flex flex-col gap-form"
            />
          </div>
        </PageLayout>
      </form>
    </FormValuesProvider>
  )
}

/**
 * Width tier for an entity's form page. `'narrow'` means the page should cap
 * at `--content-narrow` and center (`mx-auto w-full max-w-content-narrow`);
 * `'full'` spans the content column. An explicit `studio.formWidth` on the
 * entity config wins; otherwise a form earns full width only when it renders
 * a sidebar — sidebar-flagged fields or a `form.sidebar.*` widget scoped to
 * this entity.
 *
 * Lives with the page host (not inside `EntityForm`) so the wrapper can
 * include the `PageHeader` — title, toolbar, and fields center as one unit.
 * Call it unconditionally (it's a hook); safe to pass `undefined`/`[]` while
 * the entity is still loading.
 */
export function useFormWidth(entity: unknown, fields: Field[]): 'full' | 'narrow' {
  const extensions = useExtensions()
  const info = entity as { slug?: string; formWidth?: 'full' | 'narrow' } | undefined
  if (info?.formWidth) return info.formWidth
  if (fields.some((f) => f.meta?.sidebar && !f.meta?.hidden)) return 'full'
  const hasWidgets =
    extensions.widgetsForZone('form.sidebar.before', info?.slug).length > 0 ||
    extensions.widgetsForZone('form.sidebar.after', info?.slug).length > 0
  return hasWidgets ? 'full' : 'narrow'
}
