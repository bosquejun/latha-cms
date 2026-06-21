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
import type { Collection } from '../types/collection.js'
import type { CMSInstance } from '../types/config.js'
import type { AccessUser } from '../types/access.js'

export interface OperationContext {
  cms: CMSInstance
  user?: AccessUser | null
}

function resolveCollection(cms: CMSInstance, slug: string): Collection {
  const entity = cms.getEntity(slug)
  if (!entity) throw new Error(`Unknown entity: "${slug}".`)
  if (entity.kind !== 'collection') {
    throw new Error(`Entity "${slug}" is not a collection (kind: ${entity.kind}).`)
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
