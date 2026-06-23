/**
 * Extension registry — normalizes the raw `AdminExtensions` into indexed,
 * ordered lookups the admin renders from. Pure and serializable-free: it holds
 * component references, so it lives entirely on the client.
 */

import type { AdminZone } from './zones.js'
import type {
  AdminExtensions,
  DashboardWidgetExtension,
  FieldRendererExtension,
  NavItemExtension,
  PageExtension,
  SettingsPageExtension,
  WidgetExtension,
} from './types.js'

export interface ExtensionRegistry {
  /** Widgets registered for a zone, in render order. */
  widgetsForZone(zone: AdminZone): WidgetExtension[]
  /** Custom pages, sorted. */
  readonly pages: PageExtension[]
  /** Dashboard widgets, sorted. */
  readonly dashboardWidgets: DashboardWidgetExtension[]
  /** Settings pages, sorted. */
  readonly settings: SettingsPageExtension[]
  /** Field-renderer overrides. */
  readonly fields: FieldRendererExtension[]
  /** Standalone sidebar links, sorted. */
  readonly nav: NavItemExtension[]
  /** Resolve a custom page by its mount path. */
  pageFor(path: string): PageExtension | undefined
  /** Resolve a settings page by its mount path. */
  settingsFor(path: string): SettingsPageExtension | undefined
  /** True when nothing has been registered (lets hosts skip extension chrome). */
  readonly isEmpty: boolean
}

const byOrder = <T extends { order?: number }>(a: T, b: T): number =>
  (a.order ?? 0) - (b.order ?? 0)

const EMPTY_WIDGETS: WidgetExtension[] = []

export function createExtensionRegistry(
  ext: AdminExtensions = {},
): ExtensionRegistry {
  // Index widgets by zone (a widget may declare several), stable-sorted by order.
  const widgetsByZone = new Map<AdminZone, WidgetExtension[]>()
  for (const widget of ext.widgets ?? []) {
    const zones = Array.isArray(widget.zone) ? widget.zone : [widget.zone]
    for (const zone of zones) {
      const list = widgetsByZone.get(zone)
      if (list) list.push(widget)
      else widgetsByZone.set(zone, [widget])
    }
  }
  for (const list of widgetsByZone.values()) list.sort(byOrder)

  const pages = [...(ext.pages ?? [])].sort(byOrder)
  const dashboardWidgets = [...(ext.dashboardWidgets ?? [])].sort(byOrder)
  const settings = [...(ext.settings ?? [])].sort(byOrder)
  const fields = [...(ext.fields ?? [])]
  const nav = [...(ext.nav ?? [])].sort(byOrder)

  const pageByPath = new Map(pages.map((p) => [normalize(p.path), p]))
  const settingsByPath = new Map(settings.map((s) => [normalize(s.path), s]))

  const isEmpty =
    pages.length === 0 &&
    dashboardWidgets.length === 0 &&
    settings.length === 0 &&
    fields.length === 0 &&
    nav.length === 0 &&
    widgetsByZone.size === 0

  return {
    widgetsForZone: (zone) => widgetsByZone.get(zone) ?? EMPTY_WIDGETS,
    pages,
    dashboardWidgets,
    settings,
    fields,
    nav,
    pageFor: (path) => pageByPath.get(normalize(path)),
    settingsFor: (path) => settingsByPath.get(normalize(path)),
    isEmpty,
  }
}

/** Strip leading/trailing slashes so `/foo/` and `foo` resolve identically. */
function normalize(path: string): string {
  return path.replace(/^\/+|\/+$/g, '')
}

/** A shared empty registry, handy as a context default. */
export const EMPTY_REGISTRY: ExtensionRegistry = createExtensionRegistry()
