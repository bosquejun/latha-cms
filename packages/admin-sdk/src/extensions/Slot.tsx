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

  return className ? <div className={className}>{content}</div> : <>{content}</>
}
