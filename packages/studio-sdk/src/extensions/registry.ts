/**
 * Extension registry — normalizes the raw `StudioExtensions` into indexed,
 * ordered lookups the Studio renders from. Pure and serializable-free: it holds
 * component references, so it lives entirely on the client.
 */

import type { StudioZone } from './zones.js'
import type {
  StudioExtensions,
  DashboardWidgetExtension,
  EntityListRendererExtension,
  FieldRendererExtension,
  NavItemExtension,
  PageExtension,
  SettingsPageExtension,
  WidgetExtension,
} from './types.js'
import type { NavIcon } from '../shell/nav.js'

export interface ExtensionRegistry {
  /**
   * Widgets registered for a zone, in render order. Pass the current entity
   * slug for entity-scoped zones to drop widgets whose `entities` declaration
   * excludes it (widgets without the declaration always pass).
   */
  widgetsForZone(zone: StudioZone, entitySlug?: string): WidgetExtension[]
  /** Custom pages, sorted. */
  readonly pages: PageExtension[]
  /** Dashboard widgets, sorted. */
  readonly dashboardWidgets: DashboardWidgetExtension[]
  /** Settings pages, sorted. */
  readonly settings: SettingsPageExtension[]
  /** Field-renderer overrides. */
  readonly fields: FieldRendererExtension[]
  /** Full list-view replacements, keyed by entity slug. */
  readonly lists: EntityListRendererExtension[]
  /** Standalone sidebar links, sorted. */
  readonly nav: NavItemExtension[]
  /** Resolve a custom page by its mount path. */
  pageFor(path: string): PageExtension | undefined
  /** Resolve a settings page by its mount path. */
  settingsFor(path: string): SettingsPageExtension | undefined
  /** Resolve a custom list-view renderer for an entity slug. */
  listRendererFor(slug: string): EntityListRendererExtension | undefined
  /** Icons for entity kinds contributed by modules/apps (e.g. collection → FileTextIcon). */
  readonly kindIcons: Partial<Record<string, NavIcon>>
  /** True when nothing has been registered (lets hosts skip extension chrome). */
  readonly isEmpty: boolean
}

const byOrder = <T extends { order?: number }>(a: T, b: T): number =>
  (a.order ?? 0) - (b.order ?? 0)

const EMPTY_WIDGETS: WidgetExtension[] = []

export function createExtensionRegistry(
  ext: StudioExtensions = {},
): ExtensionRegistry {
  // Index widgets by zone (a widget may declare several), stable-sorted by order.
  const widgetsByZone = new Map<StudioZone, WidgetExtension[]>()
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
  const lists = [...(ext.lists ?? [])]
  const nav = [...(ext.nav ?? [])].sort(byOrder)

  const pageByPath = new Map(pages.map((p) => [normalize(p.path), p]))
  const settingsByPath = new Map(settings.map((s) => [normalize(s.path), s]))
  const listBySlug = new Map(lists.map((l) => [l.slug, l]))

  const isEmpty =
    pages.length === 0 &&
    dashboardWidgets.length === 0 &&
    settings.length === 0 &&
    fields.length === 0 &&
    lists.length === 0 &&
    nav.length === 0 &&
    widgetsByZone.size === 0

  return {
    widgetsForZone: (zone, entitySlug) => {
      const widgets = widgetsByZone.get(zone) ?? EMPTY_WIDGETS
      if (entitySlug == null || widgets.length === 0) return widgets
      const scoped = widgets.filter(
        (w) => w.entities == null || w.entities.includes(entitySlug),
      )
      return scoped.length === widgets.length ? widgets : scoped
    },
    pages,
    dashboardWidgets,
    settings,
    fields,
    lists,
    nav,
    kindIcons: ext.kindIcons ?? {},
    pageFor: (path) => pageByPath.get(normalize(path)),
    settingsFor: (path) => settingsByPath.get(normalize(path)),
    listRendererFor: (slug) => listBySlug.get(slug),
    isEmpty,
  }
}

/** Strip leading/trailing slashes so `/foo/` and `foo` resolve identically. */
function normalize(path: string): string {
  return path.replace(/^\/+|\/+$/g, '')
}

/** A shared empty registry, handy as a context default. */
export const EMPTY_REGISTRY: ExtensionRegistry = createExtensionRegistry()
