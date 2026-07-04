/**
 * Shared RPC contract between the Latha client and server dispatcher.
 *
 * The whole admin surface is driven by a single server function so the
 * consuming app only has to declare one endpoint. This file is client-safe
 * (no server imports) and is shared by both ends.
 *
 * `LathaRpcInputSchema` is the single source of truth for the RPC input
 * shape: `LathaRpcInput` is inferred from it, and the server dispatcher
 * (`@latha/start`) validates raw request bodies against this same schema
 * before dispatch — no hand-mirrored type/schema pair to drift apart.
 */

import { z } from 'zod'
import type { JsonValue } from '@latha/core'

export const LathaRpcInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('nav') }),
  z.object({ action: z.literal('entity'), slug: z.string() }),
  z.object({ action: z.literal('list'), slug: z.string() }),
  z.object({ action: z.literal('get'), slug: z.string(), id: z.string() }),
  z.object({ action: z.literal('create'), slug: z.string(), data: z.record(z.unknown()) }),
  z.object({
    action: z.literal('update'),
    slug: z.string(),
    id: z.string(),
    data: z.record(z.unknown()),
  }),
  z.object({ action: z.literal('remove'), slug: z.string(), id: z.string() }),
  z.object({ action: z.literal('getGlobal'), slug: z.string() }),
  z.object({ action: z.literal('saveGlobal'), slug: z.string(), data: z.record(z.unknown()) }),
  z.object({ action: z.literal('currentUser') }),
  z.object({ action: z.literal('login'), email: z.string(), password: z.string() }),
  z.object({ action: z.literal('logout') }),
])

export type LathaRpcInput = z.infer<typeof LathaRpcInputSchema>

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
  /** Opaque entity kind tag stamped by the module (e.g. 'collection', 'document', 'taxonomy'). */
  kind: string
  /** Structural cardinality from core: 'many' for list entities, 'single' for singletons. */
  cardinality: 'many' | 'single'
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
  /** Opaque entity kind tag stamped by the module (e.g. 'collection', 'document', 'taxonomy'). */
  kind: string
  label: string
  fields: JsonValue
  useAsTitle?: string
  defaultColumns?: string[]
}

/** The single server function signature the app wires up. */
export type LathaServerFn = (args: {
  data: LathaRpcInput
}) => Promise<unknown>
