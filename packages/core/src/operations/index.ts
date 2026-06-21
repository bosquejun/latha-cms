/**
 * CRUD operations — the local API.
 *
 * Each operation threads a request through the full kernel pipeline:
 *
 *   access check → Zod validation → before* hooks → DB → after* hooks
 *
 * Server functions (in the modules / playground) are thin wrappers over
 * these. The admin UI and the public API both go through here, so there is no
 * special-cased path for either.
 */

import { assertAccess } from '../access/evaluator.js'
import { runHookEvent } from '../hooks/engine.js'
import { buildZodSchema } from '../schema/builder.js'
import type { Doc, Query } from '../types/adapter.js'
import type { Collection, Document, Taxonomy } from '../types/collection.js'
import type { LathaInstance } from '../types/config.js'
import type { AccessUser } from '../types/access.js'

export interface OperationContext {
  cms: LathaInstance
  user?: AccessUser | null
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

export async function find(
  ctx: OperationContext,
  slug: string,
  query?: Query,
): Promise<Doc[]> {
  const collection = resolveCollection(ctx.cms, slug)
  const user = ctx.user ?? null
  await assertAccess(collection.access, { user, operation: 'read' }, slug)
  return ctx.cms.db.find(slug, query)
}

export async function findOne(
  ctx: OperationContext,
  slug: string,
  id: string,
): Promise<Doc | null> {
  const collection = resolveCollection(ctx.cms, slug)
  const user = ctx.user ?? null
  const doc = await ctx.cms.db.findOne(slug, id)
  if (!doc) return null
  await assertAccess(collection.access, { user, operation: 'read', doc }, slug)
  return doc
}

export async function create(
  ctx: OperationContext,
  slug: string,
  data: unknown,
): Promise<Doc> {
  const collection = resolveCollection(ctx.cms, slug)
  const user = ctx.user ?? null

  await assertAccess(
    collection.access,
    { user, operation: 'create', data },
    slug,
  )

  const schema = buildZodSchema(collection.fields)
  const validated = schema.parse(data) as Record<string, unknown>

  const afterHooks = await runHookEvent(collection.hooks, 'beforeCreate', {
    data: validated,
    user,
    operation: 'create',
    collection: slug,
  })

  const created = await ctx.cms.db.create(slug, afterHooks)

  return runHookEvent(collection.hooks, 'afterCreate', {
    data: created,
    user,
    operation: 'create',
    collection: slug,
  }) as Promise<Doc>
}

export async function update(
  ctx: OperationContext,
  slug: string,
  id: string,
  data: unknown,
): Promise<Doc> {
  const collection = resolveCollection(ctx.cms, slug)
  const user = ctx.user ?? null

  const previousDoc = await ctx.cms.db.findOne(slug, id)
  if (!previousDoc) throw new Error(`Document "${slug}/${id}" not found.`)

  await assertAccess(
    collection.access,
    { user, operation: 'update', doc: previousDoc, data },
    slug,
  )

  // Partial update: only validate the provided keys.
  const schema = buildZodSchema(collection.fields).partial()
  const validated = schema.parse(data) as Record<string, unknown>

  const beforeData = await runHookEvent(collection.hooks, 'beforeUpdate', {
    data: validated,
    user,
    operation: 'update',
    collection: slug,
    previousDoc,
  })

  const updated = await ctx.cms.db.update(slug, id, beforeData)

  return runHookEvent(collection.hooks, 'afterUpdate', {
    data: updated,
    user,
    operation: 'update',
    collection: slug,
    previousDoc,
  }) as Promise<Doc>
}

export async function destroy(
  ctx: OperationContext,
  slug: string,
  id: string,
): Promise<void> {
  const collection = resolveCollection(ctx.cms, slug)
  const user = ctx.user ?? null

  const doc = await ctx.cms.db.findOne(slug, id)
  if (!doc) throw new Error(`Document "${slug}/${id}" not found.`)

  await assertAccess(collection.access, { user, operation: 'delete', doc }, slug)

  await runHookEvent(collection.hooks, 'beforeDelete', {
    data: doc,
    user,
    operation: 'delete',
    collection: slug,
  })

  await ctx.cms.db.delete(slug, id)

  await runHookEvent(collection.hooks, 'afterDelete', {
    data: doc,
    user,
    operation: 'delete',
    collection: slug,
  })
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
  const user = ctx.user ?? null
  const rows = await ctx.cms.db.find(slug, { limit: 1 })
  const doc = rows[0] ?? null
  await assertAccess(document.access, { user, operation: 'read', doc: doc ?? undefined }, slug)
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
  const user = ctx.user ?? null

  const existing = (await ctx.cms.db.find(slug, { limit: 1 }))[0] ?? null
  const operation = existing ? 'update' : 'create'

  await assertAccess(
    document.access,
    { user, operation, doc: existing ?? undefined, data },
    slug,
  )

  const base = buildZodSchema(document.fields)
  const schema = existing ? base.partial() : base
  const validated = schema.parse(data) as Record<string, unknown>

  const beforeEvent = existing ? 'beforeUpdate' : 'beforeCreate'
  const afterEvent = existing ? 'afterUpdate' : 'afterCreate'

  const before = await runHookEvent(document.hooks, beforeEvent, {
    data: validated,
    user,
    operation,
    collection: slug,
    previousDoc: existing ?? undefined,
  })

  const saved = existing
    ? await ctx.cms.db.update(slug, existing.id, before)
    : await ctx.cms.db.create(slug, before)

  return runHookEvent(document.hooks, afterEvent, {
    data: saved,
    user,
    operation,
    collection: slug,
    previousDoc: existing ?? undefined,
  }) as Promise<Doc>
}

// ---------------------------------------------------------------------------
// Taxonomy operations
// ---------------------------------------------------------------------------

export interface TermNode extends Doc {
  children: TermNode[]
}

/** List taxonomy terms, ordered by name. */
export async function listTerms(
  ctx: OperationContext,
  slug: string,
): Promise<Doc[]> {
  resolveTaxonomy(ctx.cms, slug)
  return ctx.cms.db.find(slug, { sort: [{ field: 'name', direction: 'asc' }] })
}

/** Create a taxonomy term. */
export async function createTerm(
  ctx: OperationContext,
  slug: string,
  data: unknown,
): Promise<Doc> {
  const taxonomy = resolveTaxonomy(ctx.cms, slug)
  const schema = buildZodSchema(taxonomy.fields ?? [])
  const validated = schema.parse(data) as Record<string, unknown>
  return ctx.cms.db.create(slug, validated)
}

/** Delete a taxonomy term. */
export async function removeTerm(
  ctx: OperationContext,
  slug: string,
  id: string,
): Promise<void> {
  resolveTaxonomy(ctx.cms, slug)
  await ctx.cms.db.delete(slug, id)
}

/**
 * Build a nested tree from a (hierarchical) taxonomy's terms using each
 * term's `parent` field. Flat taxonomies simply return all terms as roots.
 */
export async function tree(
  ctx: OperationContext,
  slug: string,
): Promise<TermNode[]> {
  const terms = await listTerms(ctx, slug)
  const byId = new Map<string, TermNode>()
  for (const term of terms) byId.set(term.id, { ...term, children: [] })

  const roots: TermNode[] = []
  for (const node of byId.values()) {
    const parentId = node.parent as string | undefined
    const parent = parentId ? byId.get(parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}
