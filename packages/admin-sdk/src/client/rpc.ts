/**
 * Shared RPC contract between the Latha client and server dispatcher.
 *
 * The whole admin surface is driven by a single server function so the
 * consuming app only has to declare one endpoint. This file is client-safe
 * (types + no server imports) and is shared by both ends.
 */

import type { JsonValue } from '@latha/core'

export type LathaRpcInput =
  | { action: 'nav' }
  | { action: 'entity'; slug: string }
  | { action: 'list'; collection: string }
  | { action: 'get'; collection: string; id: string }
  | { action: 'create'; collection: string; data: Record<string, unknown> }
  | {
      action: 'update'
      collection: string
      id: string
      data: Record<string, unknown>
    }
  | { action: 'remove'; collection: string; id: string }
  | { action: 'getGlobal'; slug: string }
  | { action: 'saveGlobal'; slug: string; data: Record<string, unknown> }
  | { action: 'currentUser' }
  | { action: 'login'; email: string; password: string }
  | { action: 'logout' }

/** A document as it crosses the wire — always JSON-serializable. */
export type JsonDoc = { id: string } & Record<string, JsonValue>

export interface SessionUser {
  id: string
  email: string | null
  name: string | null
  /** Role names the user holds. */
  roles: string[]
  /** Effective permission keys (union across roles), for client-side gating. */
  permissions: string[]
}

export interface NavItem {
  slug: string
  kind: 'collection' | 'document' | 'taxonomy'
  label: string
  href: string
  /** Sort order within the section (lower first). */
  order?: number
}

/** A sidebar section: a heading + its entity items, grouped by module/group. */
export interface NavSection {
  /** Stable key (the group label). */
  key: string
  /** Which sidebar this section belongs to. Defaults to `main`. */
  area?: 'main' | 'settings'
  label: string
  /** Section sort order (lower first). */
  order: number
  /** Render as a collapsible group. */
  collapsible?: boolean
  /** Start collapsed (only meaningful when `collapsible`). */
  defaultCollapsed?: boolean
  items: NavItem[]
}

/** Serializable entity descriptor used to render lists/forms. */
export interface EntityDescriptor {
  slug: string
  kind: 'collection' | 'document' | 'taxonomy'
  label: string
  fields: JsonValue
  useAsTitle?: string
  defaultColumns?: string[]
}

/** The single server function signature the app wires up. */
export type LathaServerFn = (args: {
  data: LathaRpcInput
}) => Promise<unknown>
