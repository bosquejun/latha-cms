/**
 * CRUD operations — the local API.
 *
 * Each operation threads a request through the full kernel pipeline:
 *
 *   access predicate → guard chain → Zod validation → before* hooks → DB → after* hooks
 *
 * The kernel is auth-agnostic: it carries an opaque `principal` (whatever the
 * caller supplied) and an opaque `context` bag, and runs any registered guards
 * (see `registerGuard`) for cross-cutting authorization such as RBAC. It never
 * interprets either. Server functions (in the modules / playground) are thin
 * wrappers over these. The admin UI and the public API both go through here, so
 * there is no special-cased path for either.
 */

import { assertAccess } from '../access/evaluator.js'
import { runHookEvent } from '../hooks/engine.js'
import { fieldRegistry } from '../fields/registry.js'
import type { Doc, Query } from '../types/adapter.js'
import { isMany, isSingle, type Entity } from '../types/entity.js'
import type { LathaInstance } from '../types/config.js'
import type { Operation } from '../types/access.js'
import type { GuardContext } from '../types/guard.js'

export interface OperationContext {
  cms: LathaInstance
  /** The caller principal, opaque to the kernel. Defaults to anonymous (`null`). */
  principal?: unknown
  /**
   * Opaque context bag threaded to guards (e.g. `{ enforce: true }` from the
   * admin RPC layer). The kernel does not read it.
   */
  context?: Record<string, unknown>
}

/** Run every registered guard for an operation; any throw denies it. */
async function runGuards(
  ctx: OperationContext,
  entity: Entity,
  operation: Operation,
  extras: { data?: unknown; doc?: unknown } = {},
): Promise<void> {
  const guards = ctx.cms.guards
  if (guards.length === 0) return
  const guardCtx: GuardContext = {
    cms: ctx.cms,
    operation,
    slug: entity.slug,
    cardinality: entity.cardinality,
    principal: ctx.principal ?? null,
    data: extras.data,
    doc: extras.doc,
    context: ctx.context ?? {},
  }
  for (const guard of guards) await guard(guardCtx)
}

function resolveMany(cms: LathaInstance, slug: string): Entity & { cardinality: 'many' } {
  const entity = cms.getEntity(slug)
  if (!entity) throw new Error(`Unknown entity: "${slug}".`)
  if (!isMany(entity)) {
    throw new Error(`Entity "${slug}" does not support list operations (cardinality: ${entity.cardinality}).`)
  }
  return entity
}

function resolveSingle(cms: LathaInstance, slug: string): Entity & { cardinality: 'single' } {
  const entity = cms.getEntity(slug)
  if (!entity) throw new Error(`Unknown entity: "${slug}".`)
  if (!isSingle(entity)) {
    throw new Error(`Entity "${slug}" is not a singleton (cardinality: ${entity.cardinality}).`)
  }
  return entity
}

// ---------------------------------------------------------------------------
// List operations — every `cardinality: 'many'` entity goes through these.
// ---------------------------------------------------------------------------

export async function find(
  ctx: OperationContext,
  slug: string,
  query?: Query,
): Promise<Doc[]> {
  const entity = resolveMany(ctx.cms, slug)
  const principal = ctx.principal ?? null
  await assertAccess(entity.access, { principal, operation: 'read' }, entity.slug)
  await runGuards(ctx, entity, 'read')
  return ctx.cms.db.find(entity.slug, query)
}

/** Count the records matching `query.where`, under the same read authorization as `find`. */
export async function count(
  ctx: OperationContext,
  slug: string,
  query?: Pick<Query, 'where'>,
): Promise<number> {
  const entity = resolveMany(ctx.cms, slug)
  const principal = ctx.principal ?? null
  await assertAccess(entity.access, { principal, operation: 'read' }, entity.slug)
  await runGuards(ctx, entity, 'read')
  return ctx.cms.db.count(entity.slug, query)
}

export async function findOne(
  ctx: OperationContext,
  slug: string,
  id: string,
): Promise<Doc | null> {
  const entity = resolveMany(ctx.cms, slug)
  const principal = ctx.principal ?? null
  const doc = await ctx.cms.db.findOne(slug, id)
  if (!doc) return null
  await assertAccess(entity.access, { principal, operation: 'read', doc }, slug)
  await runGuards(ctx, entity, 'read', { doc })
  return doc
}

export async function create(
  ctx: OperationContext,
  slug: string,
  data: unknown,
): Promise<Doc> {
  const entity = resolveMany(ctx.cms, slug)
  const principal = ctx.principal ?? null

  await assertAccess(entity.access, { principal, operation: 'create', data }, slug)
  await runGuards(ctx, entity, 'create', { data })

  const schema = fieldRegistry.buildDocumentSchema(entity.fields)
  const validated = schema.parse(data) as Record<string, unknown>

  const beforeData = await runHookEvent(entity.hooks, 'beforeCreate', {
    data: validated,
    principal,
    operation: 'create',
    slug,
  })

  const created = await ctx.cms.db.create(slug, beforeData)

  return runHookEvent(entity.hooks, 'afterCreate', {
    data: created,
    principal,
    operation: 'create',
    slug,
  }) as Promise<Doc>
}

export async function update(
  ctx: OperationContext,
  slug: string,
  id: string,
  data: unknown,
): Promise<Doc> {
  const entity = resolveMany(ctx.cms, slug)
  const principal = ctx.principal ?? null

  const previousDoc = await ctx.cms.db.findOne(slug, id)
  if (!previousDoc) throw new Error(`Record "${slug}/${id}" not found.`)

  await assertAccess(
    entity.access,
    { principal, operation: 'update', doc: previousDoc, data },
    slug,
  )
  await runGuards(ctx, entity, 'update', { doc: previousDoc, data })

  // Partial update: only validate the provided keys.
  const schema = fieldRegistry.buildDocumentSchema(entity.fields).partial()
  const validated = schema.parse(data) as Record<string, unknown>

  const beforeData = await runHookEvent(entity.hooks, 'beforeUpdate', {
    data: validated,
    principal,
    operation: 'update',
    slug,
    previousDoc,
  })

  const updated = await ctx.cms.db.update(slug, id, beforeData)

  return runHookEvent(entity.hooks, 'afterUpdate', {
    data: updated,
    principal,
    operation: 'update',
    slug,
    previousDoc,
  }) as Promise<Doc>
}

export async function destroy(
  ctx: OperationContext,
  slug: string,
  id: string,
): Promise<void> {
  const entity = resolveMany(ctx.cms, slug)
  const principal = ctx.principal ?? null

  const doc = await ctx.cms.db.findOne(slug, id)
  if (!doc) throw new Error(`Record "${slug}/${id}" not found.`)

  await assertAccess(entity.access, { principal, operation: 'delete', doc }, slug)
  await runGuards(ctx, entity, 'delete', { doc })

  await runHookEvent(entity.hooks, 'beforeDelete', {
    data: doc,
    principal,
    operation: 'delete',
    slug,
  })

  await ctx.cms.db.delete(slug, id)

  await runHookEvent(entity.hooks, 'afterDelete', {
    data: doc,
    principal,
    operation: 'delete',
    slug,
  })
}

// ---------------------------------------------------------------------------
// Singleton operations — every `cardinality: 'single'` entity.
// ---------------------------------------------------------------------------

/** Read the single record of a singleton entity, or `null` if unset. */
export async function findGlobal(
  ctx: OperationContext,
  slug: string,
): Promise<Doc | null> {
  const entity = resolveSingle(ctx.cms, slug)
  const principal = ctx.principal ?? null
  const rows = await ctx.cms.db.find(slug, { limit: 1 })
  const doc = rows[0] ?? null
  await assertAccess(
    entity.access,
    { principal, operation: 'read', doc: doc ?? undefined },
    slug,
  )
  await runGuards(ctx, entity, 'read', { doc: doc ?? undefined })
  return doc
}

/**
 * Upsert the single record of a singleton entity. Creates it on first save
 * and updates it thereafter, running the matching create/update hooks.
 */
export async function saveGlobal(
  ctx: OperationContext,
  slug: string,
  data: unknown,
): Promise<Doc> {
  const entity = resolveSingle(ctx.cms, slug)
  const principal = ctx.principal ?? null

  const existing = (await ctx.cms.db.find(slug, { limit: 1 }))[0] ?? null
  const operation = existing ? 'update' : 'create'

  await assertAccess(
    entity.access,
    { principal, operation, doc: existing ?? undefined, data },
    slug,
  )
  await runGuards(ctx, entity, operation, { doc: existing ?? undefined, data })

  const base = fieldRegistry.buildDocumentSchema(entity.fields)
  const schema = existing ? base.partial() : base
  const validated = schema.parse(data) as Record<string, unknown>

  const beforeEvent = existing ? 'beforeUpdate' : 'beforeCreate'
  const afterEvent = existing ? 'afterUpdate' : 'afterCreate'

  const before = await runHookEvent(entity.hooks, beforeEvent, {
    data: validated,
    principal,
    operation,
    slug,
    previousDoc: existing ?? undefined,
  })

  const saved = existing
    ? await ctx.cms.db.update(slug, existing.id, before)
    : await ctx.cms.db.create(slug, before)

  return runHookEvent(entity.hooks, afterEvent, {
    data: saved,
    principal,
    operation,
    slug,
    previousDoc: existing ?? undefined,
  }) as Promise<Doc>
}
