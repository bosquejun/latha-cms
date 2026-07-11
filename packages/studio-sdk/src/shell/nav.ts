/**
 * Shell navigation model — the tab/sub-item vocabulary shared by MainTopNav,
 * SecondaryTopNav, SectionSidebar and MobileMenu.
 *
 * Top-level sections are horizontal tabs. A tab that owns deep navigation
 * (Content's collections, Settings' panels) carries `subItems` — grouped
 * lists rendered as a SectionSidebar next to that tab's content (and nested
 * under the tab in the mobile menu). Tabs without `subItems` are plain links
 * and their pages run full-width.
 */
import type { ComponentType, ReactNode } from 'react'

export type NavIcon = ComponentType<{ className?: string }>

/** Props a router-aware link component must accept (TanStack `Link`, plain `a`, …). */
export interface NavLinkProps {
  href: string
  className?: string
  children: ReactNode
  onClick?: () => void
}

/** A single entry inside a tab's section sidebar. */
export interface ShellNavSubItem {
  key: string
  href: string
  label: string
  icon?: NavIcon
  /** Right-aligned count badge (optional — omit when counting is expensive). */
  count?: number
  /** Render a plain <a target="_blank"> and never match as active. */
  external?: boolean
  contentWidth?: 'default' | 'full'
}

/** Sub-items are grouped; a group with no label renders as a plain list. */
export interface ShellNavGroup {
  label?: string
  /** Render the heading as a fold toggle (needs a `label`). */
  collapsible?: boolean
  /** Start folded; the group still opens when it holds the active item. */
  defaultCollapsed?: boolean
  items: ShellNavSubItem[]
}

/** A top-level tab in the secondary top nav. */
export interface ShellNavItem {
  key: string
  href: string
  label: string
  icon?: NavIcon
  external?: boolean
  contentWidth?: 'default' | 'full'
  /**
   * Path prefix that marks this tab active. Defaults to `href` — set it when
   * the tab links somewhere deeper than the subtree it owns (e.g. Settings
   * links to its first panel but owns all of `/studio/settings`).
   */
  match?: string
  /** Only exact path matches activate this tab (the Dashboard tab). */
  exact?: boolean
  subItems?: ShellNavGroup[]
}

export interface ActiveNav {
  activeKey?: string
  activeSubKey?: string
}

const matchesPrefix = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`)

/**
 * Resolve which tab (and sub-item) the current path belongs to. Longest
 * matching prefix wins, so `/studio/settings/roles` activates the Roles
 * sub-item rather than the Settings tab's own href.
 */
export function resolveActiveNav(items: ShellNavItem[], currentPath?: string): ActiveNav {
  if (!currentPath) return {}
  let best: ActiveNav & { length: number } = { length: -1 }

  for (const item of items) {
    if (item.external) continue
    const prefix = item.match ?? item.href
    const hit = item.exact ? currentPath === prefix : matchesPrefix(currentPath, prefix)
    if (hit && prefix.length > best.length) {
      best = { activeKey: item.key, length: prefix.length }
    }
    for (const group of item.subItems ?? []) {
      for (const sub of group.items) {
        if (sub.external) continue
        // `>=`, not `>`: a tab links to its first sub-item, so the two hrefs
        // tie in length — the tie must resolve to the sub-item or that
        // sub-item never highlights.
        if (matchesPrefix(currentPath, sub.href) && sub.href.length >= best.length) {
          best = { activeKey: item.key, activeSubKey: sub.key, length: sub.href.length }
        }
      }
    }
  }
  return { activeKey: best.activeKey, activeSubKey: best.activeSubKey }
}
