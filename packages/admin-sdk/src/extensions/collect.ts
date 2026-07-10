/**
 * Shared admin-extension assembly. Turns convention-folder glob maps (from
 * `import.meta.glob(..., { eager: true })`) into a typed `AdminExtensions`,
 * and merges several `AdminExtensions` with later-source-wins precedence.
 * One implementation shared across every source of admin extensions.
 */
import type {
  AdminExtensions,
  DashboardWidgetExtension,
  EntityListRendererExtension,
  FieldRendererExtension,
  PageExtension,
  SettingsPageExtension,
  WidgetExtension,
} from './types.js'

export type GlobMap = Record<string, { default?: unknown; config?: unknown }>

export interface AdminGlobs {
  widgets?: GlobMap
  pages?: GlobMap
  dashboard?: GlobMap
  settings?: GlobMap
  fields?: GlobMap
  lists?: GlobMap
}

const entries = (map: GlobMap = {}) =>
  Object.keys(map)
    .sort()
    .map((id) => ({ id, mod: map[id]! }))

const cfg = (mod?: { config?: unknown } | null) =>
  (mod?.config ?? {}) as Record<string, unknown>

export function collectAdminExtensions(globs: AdminGlobs): AdminExtensions {
  const widgets = entries(globs.widgets)
    .filter(({ mod }) => mod && mod.default && cfg(mod).zone)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...cfg(mod) })) as WidgetExtension[]

  const pages = entries(globs.pages)
    .filter(({ mod }) => mod && mod.default && cfg(mod).path)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...cfg(mod) })) as PageExtension[]

  const dashboardWidgets = entries(globs.dashboard)
    .filter(({ mod }) => mod && mod.default)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...cfg(mod) })) as DashboardWidgetExtension[]

  const settings = entries(globs.settings)
    .filter(({ mod }) => mod && mod.default && cfg(mod).path)
    .map(({ id, mod }) => ({ id, Component: mod.default, ...cfg(mod) })) as SettingsPageExtension[]

  const fields = entries(globs.fields)
    .filter(({ mod }) => mod && mod.default && cfg(mod).type)
    .map(({ mod }) => ({ type: cfg(mod).type, renderer: mod.default })) as FieldRendererExtension[]

  const lists = entries(globs.lists)
    .filter(({ mod }) => mod && mod.default && cfg(mod).slug)
    .map(({ mod }) => ({ slug: cfg(mod).slug, Component: mod.default })) as EntityListRendererExtension[]

  return {
    widgets: widgets.length ? widgets : undefined,
    pages: pages.length ? pages : undefined,
    dashboardWidgets: dashboardWidgets.length ? dashboardWidgets : undefined,
    settings: settings.length ? settings : undefined,
    fields: fields.length ? fields : undefined,
    lists: lists.length ? lists : undefined,
  }
}

const dedupeBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const map = new Map<string, T>()
  for (const item of items) map.set(key(item), item) // later wins
  return [...map.values()]
}

export function mergeExtensions(sources: AdminExtensions[]): AdminExtensions {
  return {
    widgets: dedupeBy(
      sources.flatMap((s) => s.widgets ?? []),
      (w) => w.id ?? JSON.stringify(w.zone),
    ),
    pages: dedupeBy(
      sources.flatMap((s) => s.pages ?? []),
      (p) => p.path,
    ),
    dashboardWidgets: dedupeBy(
      sources.flatMap((s) => s.dashboardWidgets ?? []),
      (d) => d.id ?? '',
    ),
    settings: dedupeBy(
      sources.flatMap((s) => s.settings ?? []),
      (s) => s.path,
    ),
    fields: dedupeBy(
      sources.flatMap((s) => s.fields ?? []),
      (f) => f.type,
    ),
    lists: dedupeBy(
      sources.flatMap((s) => s.lists ?? []),
      (l) => l.slug,
    ),
    nav: dedupeBy(
      sources.flatMap((s) => s.nav ?? []),
      (n) => n.href,
    ),
    // Later source wins per key (the app overrides module defaults).
    kindIcons: Object.assign({}, ...sources.map((s) => s.kindIcons ?? {})),
  }
}
