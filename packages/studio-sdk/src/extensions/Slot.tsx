/**
 * `<Slot>` — renders every widget registered for a zone, in order, handing each
 * the `WidgetContext`. Renders nothing when the zone is empty, so it's a
 * zero-cost marker to scatter through the shell and views.
 */

import { Fragment } from 'react'
import { useZoneWidgets } from './context.js'
import type { StudioZone } from './zones.js'

export interface SlotProps {
  zone: StudioZone
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
  // only reflects registration, not actual output. `contents!` (Tailwind's
  // `!important` beats the `flex`/`grid` display every caller's `className`
  // sets) keeps this wrapper from generating its own box, so a widget that
  // renders null contributes nothing to the parent's layout — as if it were
  // never registered. Widgets that do render have their children promoted
  // straight into the parent's layout instead.
  return className ? <div className={`contents! ${className}`}>{content}</div> : <>{content}</>
}
