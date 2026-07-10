/**
 * Shared RPC contract between the Kon10 client and server dispatcher.
 *
 * The whole Studio surface is driven by a single server function so the
 * consuming app only has to declare one endpoint. This file is client-safe
 * (no server imports) and is shared by both ends.
 *
 * `Kon10RpcInputSchema` is the single source of truth for the RPC input
 * shape: `Kon10RpcInput` is inferred from it, and the server dispatcher
 * (`@kon10/start`) validates raw request bodies against this same schema
 * before dispatch — no hand-mirrored type/schema pair to drift apart.
 */

import { z } from 'zod'
import type { JsonValue } from '@kon10/core'

export const Kon10RpcInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('nav') }),
  z.object({ action: z.literal('entity'), slug: z.string() }),
  z.object({ action: z.literal('list'), slug: z.string() }),
  z.object({
    action: z.literal('page'),
    slug: z.string(),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
    sort: z
      .array(z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) }))
      .optional(),
  }),
  z.object({ action: z.literal('get'), slug: z.string(), id: z.string() }),
  z.object({ action: z.literal('create'), slug: z.string(), data: z.record(z.string(), z.unknown()) }),
  z.object({
    action: z.literal('update'),
    slug: z.string(),
    id: z.string(),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({ action: z.literal('remove'), slug: z.string(), id: z.string() }),
  z.object({ action: z.literal('getGlobal'), slug: z.string() }),
  z.object({ action: z.literal('saveGlobal'), slug: z.string(), data: z.record(z.string(), z.unknown()) }),
])

export type Kon10RpcInput = z.infer<typeof Kon10RpcInputSchema>

/** A document as it crosses the wire — always JSON-serializable. */
export type JsonDoc = { id: string } & Record<string, JsonValue>

/** One page of a list plus the total row count — the `page` action's result. */
export interface PageResult {
  docs: JsonDoc[]
  total: number
  limit: number
  offset: number
}

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
export type Kon10ServerFn = (args: {
  data: Kon10RpcInput
}) => Promise<unknown>
