/**
 * `<Slot>` — renders every widget registered for a zone, in order, handing each
 * the `WidgetContext`. Renders nothing when the zone is empty, so it's a
 * zero-cost marker to scatter through the shell and views.
 */

import { Fragment } from 'react'
import { useZoneWidgets } from './context.js'
import type { AdminZone } from './zones.js'

export interface SlotProps {
  zone: AdminZone
  /** Entity descriptor for entity-scoped zones (list/form/document). */
  entity?: unknown
  /** Record id for edit-form zones. */
  recordId?: string
  /** Extra view-specific payload forwarded to widgets. */
  data?: Record<string, unknown>
  /**
   * Optional wrapper. When set, the rendered widgets are wrapped in a `<div>`
   * with this class — but only if at least one widget exists, so empty zones
   * never emit stray markup.
   */
  className?: string
}

export function Slot({ zone, entity, recordId, data, className }: SlotProps) {
  const widgets = useZoneWidgets(zone)
  if (widgets.length === 0) return null

  const content = widgets.map((widget, index) => (
    <Fragment key={widget.id ?? index}>
      <widget.Component zone={zone} entity={entity} recordId={recordId} data={data} />
    </Fragment>
  ))

  // A registered widget may itself render nothing for the current context
  // (e.g. it bails out for entities it doesn't apply to) — `widgets.length`
  // only reflects registration, not actual output. `contents!` (forced via
  // Tailwind's important modifier — every caller's `className` also sets
  // `display` via `flex`/`grid`, which would otherwise win the cascade over
  // a plain `contents`, per Tailwind's fixed utility ordering rather than
  // class-list order) keeps this wrapper from ever generating its own box,
  // so a widget that renders null contributes zero flex items/gap to the
  // parent layout — exactly as if nothing had been registered for this zone
  // at all. The caller's layout classes still apply to any widgets that do
  // render: with no box of its own, this element's children are promoted to
  // participate directly in the parent's layout instead.
  return className ? <div className={`contents! ${className}`}>{content}</div> : <>{content}</>
}
