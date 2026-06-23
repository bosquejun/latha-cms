/**
 * The extension contract — the typed shapes a dev provides to customize the
 * admin, plus identity `define*` helpers for type inference and DX.
 *
 * Two authoring styles share these types:
 *  - **Explicit:** build an `AdminExtensions` object and hand it to
 *    `<LathaProvider extensions={…}>` (use `defineAdminExtensions` for inference).
 *  - **Convention:** drop files under `src/admin/**`, each exporting a default
 *    component plus a `config` from one of the `define*Config` helpers. The
 *    `lathaStart()` Vite plugin assembles them into the same `AdminExtensions`.
 */

import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { FieldType } from '@latha/core'
import type { AdminZone, WidgetContext } from './zones.js'
import type { FieldRenderer } from '../fields/types.js'

/** A widget is any component that accepts the zone `WidgetContext`. */
export type WidgetComponent = ComponentType<WidgetContext>

/** Config a widget file declares (convention mode); the component is its default export. */
export interface WidgetConfig {
  /** One zone, or several, to render into. */
  zone: AdminZone | AdminZone[]
  /** Lower renders first within a zone. Default 0. */
  order?: number
}

export interface WidgetExtension extends WidgetConfig {
  Component: WidgetComponent
  /** Stable id (auto-set to the file path in convention mode). */
  id?: string
}

/** Props passed to a custom page / settings page component. */
export interface PageComponentProps {
  /** The page's mount path (relative to the admin base), e.g. `analytics`. */
  path: string
  /** Splat segments after the mount path: `/admin/analytics/a/b` → `['a','b']`. */
  params: string[]
}

export interface PageConfig {
  /** Mounted at `<adminBase>/<path>` — e.g. `analytics` → `/admin/analytics`. */
  path: string
  /** Sidebar label. */
  label: string
  /** Sidebar icon. */
  icon?: LucideIcon
  /** Sidebar group heading. Default `Extensions`. */
  group?: string
  /** Routable but hidden from the sidebar. */
  hidden?: boolean
  order?: number
}

export interface PageExtension extends PageConfig {
  Component: ComponentType<PageComponentProps>
  id?: string
}

export interface DashboardWidgetConfig {
  /** Grid columns to span (the dashboard grid is 4-wide on large screens). */
  span?: 1 | 2 | 3 | 4
  order?: number
}

export interface DashboardWidgetExtension extends DashboardWidgetConfig {
  Component: WidgetComponent
  id?: string
}

export interface SettingsPageConfig {
  /** Mounted at `<adminBase>/settings/<path>`. */
  path: string
  label: string
  description?: string
  icon?: LucideIcon
  order?: number
}

export interface SettingsPageExtension extends SettingsPageConfig {
  Component: ComponentType<PageComponentProps>
  id?: string
}

export interface FieldRendererConfig {
  /** The field type this renderer handles (overrides the built-in). */
  type: FieldType
}

export interface FieldRendererExtension extends FieldRendererConfig {
  renderer: FieldRenderer
}

/** A plain sidebar link (internal route or external URL) with no page body. */
export interface NavItemExtension {
  label: string
  href: string
  icon?: LucideIcon
  /** Sidebar group heading. Default `Extensions`. */
  group?: string
  /** Open in a new tab. */
  external?: boolean
  order?: number
}

/** The aggregate of everything a dev can contribute to the admin UI. */
export interface AdminExtensions {
  widgets?: WidgetExtension[]
  pages?: PageExtension[]
  dashboardWidgets?: DashboardWidgetExtension[]
  settings?: SettingsPageExtension[]
  fields?: FieldRendererExtension[]
  nav?: NavItemExtension[]
}

// ── Identity helpers ────────────────────────────────────────────────────────
// Each returns its argument unchanged; the value is in the type annotation,
// which gives autocomplete and catches typos at author time.

/** Type a full set of extensions (explicit mode). */
export function defineAdminExtensions(ext: AdminExtensions): AdminExtensions {
  return ext
}

/** Declare a widget file's config (convention mode). */
export function defineWidgetConfig(config: WidgetConfig): WidgetConfig {
  return config
}

/** Declare a custom-page file's config (convention mode). */
export function definePageConfig(config: PageConfig): PageConfig {
  return config
}

/** Declare a dashboard-widget file's config (convention mode). */
export function defineDashboardWidgetConfig(
  config: DashboardWidgetConfig = {},
): DashboardWidgetConfig {
  return config
}

/** Declare a settings-page file's config (convention mode). */
export function defineSettingsConfig(config: SettingsPageConfig): SettingsPageConfig {
  return config
}

/** Declare a field-renderer file's config (convention mode). */
export function defineFieldConfig(config: FieldRendererConfig): FieldRendererConfig {
  return config
}
