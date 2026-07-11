/**
 * Injection zones — the catalogue of named places in the Studio UI where devs
 * can attach custom widgets.
 *
 * The naming follows `<surface>.<position>` (à la Medusa's injection zones), so
 * a zone reads as a sentence: `list.before` renders before a collection list,
 * `form.sidebar.after` renders below the form's meta sidebar. Adding a zone is a
 * two-step change: add the literal here, then drop a `<Slot zone="…" />` at the
 * matching spot in the shell or a view.
 */

export const STUDIO_ZONES = [
  // Shell chrome. Topbar and main zones are always present. The sidebar zones
  // render in the active section's rail (SectionSidebar) — so only while a
  // tab with sub-navigation is active — and in the MobileMenu sheet.
  'shell.topbar.start',
  'shell.topbar.end',
  'shell.sidebar.top',
  'shell.sidebar.bottom',
  'shell.main.before',
  'shell.main.after',

  // Dashboard.
  'dashboard.before',
  'dashboard.after',

  // Collection list view (entity-scoped).
  'list.before',
  'list.after',

  // Create / edit form (entity-scoped; `recordId` set on edit).
  'form.before',
  'form.after',
  'form.sidebar.before',
  'form.sidebar.after',

  // Global (single-cardinality) entity view (entity-scoped).
  'global.before',
  'global.after',
] as const

export type StudioZone = (typeof STUDIO_ZONES)[number]

/** Runtime guard — useful when validating zones from untyped (convention) sources. */
export function isStudioZone(value: unknown): value is StudioZone {
  return typeof value === 'string' && (STUDIO_ZONES as readonly string[]).includes(value)
}

/**
 * Context handed to every widget rendered in a zone. Entity-scoped zones
 * populate `entity` (and `recordId` on edit); shell/dashboard zones leave them
 * undefined. `data` carries any extra view-specific payload.
 */
export interface WidgetContext<TEntity = unknown> {
  /** The zone this widget is rendering in. */
  zone: StudioZone
  /** Entity descriptor in list/form/document zones; otherwise undefined. */
  entity?: TEntity
  /** Record id in edit-form zones; undefined on create and elsewhere. */
  recordId?: string
  /** Arbitrary extra context the host view chooses to pass. */
  data?: Record<string, unknown>
}
