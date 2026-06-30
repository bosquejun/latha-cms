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
import type { Collection, Document, Entity, Taxonomy } from '../types/collection.js'
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

/**
 * Either of the two entity kinds whose records go through the field-backed
 * CRUD pipeline (`Collection` and `Taxonomy`). `Document` (the singleton kind)
 * is intentionally excluded — `findGlobal`/`saveGlobal` have a different shape
 * (no id, upsert-on-save) and aren't worth folding in here.
 */
type FieldedEntity = Collection<any> | Taxonomy

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
    kind: entity.kind,
    principal: ctx.principal ?? null,
    data: extras.data,
    doc: extras.doc,
    context: ctx.context ?? {},
  }
  for (const guard of guards) await guard(guardCtx)
}

function resolveCollection(cms: LathaInstance, slug: string): Collection {
  const entity = cms.getEntity(slug)
  if (!entity) throw new Error(`Unknown entity: "${slug}".`)
  if (entity.kind !== 'collection') {
    throw new Error(`Entity "${slug}" is not a collection (kind: ${entity.kind}).`)
  }
  return entity
}

function resolveDocument(cms: LathaInstance, slug: string): Document {
  const entity = cms.getEntity(slug)
  if (!entity) throw new Error(`Unknown entity: "${slug}".`)
  if (entity.kind !== 'document') {
    throw new Error(`Entity "${slug}" is not a document (kind: ${entity.kind}).`)
  }
  return entity
}

function resolveTaxonomy(cms: LathaInstance, slug: string): Taxonomy {
  const entity = cms.getEntity(slug)
  if (!entity) throw new Error(`Unknown entity: "${slug}".`)
  if (entity.kind !== 'taxonomy') {
    throw new Error(`Entity "${slug}" is not a taxonomy (kind: ${entity.kind}).`)
  }
  return entity
}

// ---------------------------------------------------------------------------
// Shared CRUD pipeline — `Collection` and `Taxonomy` records both go through
// these; the public functions below are thin per-kind wrappers (`find` vs
// `findTerms`, `create` vs `createTerm`, …) that resolve the entity and pick
// the right not-found label.
// ---------------------------------------------------------------------------

async function runFind(
  ctx: OperationContext,
  entity: FieldedEntity,
  query?: Query,
): Promise<Doc[]> {
  const principal = ctx.principal ?? null
  await assertAccess(entity.access, { principal, operation: 'read' }, entity.slug)
  await runGuards(ctx, entity, 'read')
  return ctx.cms.db.find(entity.slug, query)
}

async function runCreate(
  ctx: OperationContext,
  entity: FieldedEntity,
  data: unknown,
): Promise<Doc> {
  const { slug } = entity
  const principal = ctx.principal ?? null

  await assertAccess(entity.access, { principal, operation: 'create', data }, slug)
  await runGuards(ctx, entity, 'create', { data })

  const schema = fieldRegistry.buildDocumentSchema(entity.fields ?? [])
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

async function runUpdate(
  ctx: OperationContext,
  entity: FieldedEntity,
  id: string,
  data: unknown,
  notFoundLabel: string,
): Promise<Doc> {
  const { slug } = entity
  const principal = ctx.principal ?? null

  const previousDoc = await ctx.cms.db.findOne(slug, id)
  if (!previousDoc) throw new Error(`${notFoundLabel} "${slug}/${id}" not found.`)

  await assertAccess(
    entity.access,
    { principal, operation: 'update', doc: previousDoc, data },
    slug,
  )
  await runGuards(ctx, entity, 'update', { doc: previousDoc, data })

  // Partial update: only validate the provided keys.
  const schema = fieldRegistry.buildDocumentSchema(entity.fields ?? []).partial()
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

async function runDestroy(
  ctx: OperationContext,
  entity: FieldedEntity,
  id: string,
  notFoundLabel: string,
): Promise<void> {
  const { slug } = entity
  const principal = ctx.principal ?? null

  const doc = await ctx.cms.db.findOne(slug, id)
  if (!doc) throw new Error(`${notFoundLabel} "${slug}/${id}" not found.`)

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
// Collection (document) operations
// ---------------------------------------------------------------------------

export async function find(
  ctx: OperationContext,
  slug: string,
  query?: Query,
): Promise<Doc[]> {
  return runFind(ctx, resolveCollection(ctx.cms, slug), query)
}

export async function findOne(
  ctx: OperationContext,
  slug: string,
  id: string,
): Promise<Doc | null> {
  const collection = resolveCollection(ctx.cms, slug)
  const principal = ctx.principal ?? null
  const doc = await ctx.cms.db.findOne(slug, id)
  if (!doc) return null
  await assertAccess(collection.access, { principal, operation: 'read', doc }, slug)
  await runGuards(ctx, collection, 'read', { doc })
  return doc
}

export async function create(
  ctx: OperationContext,
  slug: string,
  data: unknown,
): Promise<Doc> {
  return runCreate(ctx, resolveCollection(ctx.cms, slug), data)
}

export async function update(
  ctx: OperationContext,
  slug: string,
  id: string,
  data: unknown,
): Promise<Doc> {
  return runUpdate(ctx, resolveCollection(ctx.cms, slug), id, data, 'Document')
}

export async function destroy(
  ctx: OperationContext,
  slug: string,
  id: string,
): Promise<void> {
  return runDestroy(ctx, resolveCollection(ctx.cms, slug), id, 'Document')
}

// ---------------------------------------------------------------------------
// Document (singleton) operations
// ---------------------------------------------------------------------------

/** Read the single record of a document singleton, or `null` if unset. */
export async function findGlobal(
  ctx: OperationContext,
  slug: string,
): Promise<Doc | null> {
  const document = resolveDocument(ctx.cms, slug)
  const principal = ctx.principal ?? null
  const rows = await ctx.cms.db.find(slug, { limit: 1 })
  const doc = rows[0] ?? null
  await assertAccess(
    document.access,
    { principal, operation: 'read', doc: doc ?? undefined },
    slug,
  )
  await runGuards(ctx, document, 'read', { doc: doc ?? undefined })
  return doc
}

/**
 * Upsert the single record of a document singleton. Creates it on first save
 * and updates it thereafter, running the matching create/update hooks.
 */
export async function saveGlobal(
  ctx: OperationContext,
  slug: string,
  data: unknown,
): Promise<Doc> {
  const document = resolveDocument(ctx.cms, slug)
  const principal = ctx.principal ?? null

  const existing = (await ctx.cms.db.find(slug, { limit: 1 }))[0] ?? null
  const operation = existing ? 'update' : 'create'

  await assertAccess(
    document.access,
    { principal, operation, doc: existing ?? undefined, data },
    slug,
  )
  await runGuards(ctx, document, operation, { doc: existing ?? undefined, data })

  const base = fieldRegistry.buildDocumentSchema(document.fields)
  const schema = existing ? base.partial() : base
  const validated = schema.parse(data) as Record<string, unknown>

  const beforeEvent = existing ? 'beforeUpdate' : 'beforeCreate'
  const afterEvent = existing ? 'afterUpdate' : 'afterCreate'

  const before = await runHookEvent(document.hooks, beforeEvent, {
    data: validated,
    principal,
    operation,
    slug,
    previousDoc: existing ?? undefined,
  })

  const saved = existing
    ? await ctx.cms.db.update(slug, existing.id, before)
    : await ctx.cms.db.create(slug, before)

  return runHookEvent(document.hooks, afterEvent, {
    data: saved,
    principal,
    operation,
    slug,
    previousDoc: existing ?? undefined,
  }) as Promise<Doc>
}

// ---------------------------------------------------------------------------
// Taxonomy (term) operations
// ---------------------------------------------------------------------------

export async function findTerms(
  ctx: OperationContext,
  slug: string,
  query?: Query,
): Promise<Doc[]> {
  return runFind(ctx, resolveTaxonomy(ctx.cms, slug), query)
}

export async function createTerm(
  ctx: OperationContext,
  slug: string,
  data: unknown,
): Promise<Doc> {
  return runCreate(ctx, resolveTaxonomy(ctx.cms, slug), data)
}

export async function updateTerm(
  ctx: OperationContext,
  slug: string,
  id: string,
  data: unknown,
): Promise<Doc> {
  return runUpdate(ctx, resolveTaxonomy(ctx.cms, slug), id, data, 'Term')
}

export async function destroyTerm(
  ctx: OperationContext,
  slug: string,
  id: string,
): Promise<void> {
  return runDestroy(ctx, resolveTaxonomy(ctx.cms, slug), id, 'Term')
}
