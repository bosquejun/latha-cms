/**
 * Config-driven content API.
 *
 * `createContentApi()` binds the kernel's local operations to a CMS provider
 * and returns plain async handlers for every collection/document/taxonomy in
 * the config — list, findOne, create, update, delete (plus singleton and
 * taxonomy variants). Results are projected to JSON-serializable values so the
 * handlers can be wrapped directly by TanStack Start server functions.
 *
 * There is no per-collection codegen: a single generic handler set is
 * parameterized by the entity `slug` at call time, which is resolved against
 * the module registry. Every entity in the config therefore gets a full API
 * for free.
 */

import { operations, buildZodSchema } from '@latha/core'
import type {
  LathaInstance,
  Doc,
  JsonValue,
  Query,
  Taxonomy,
} from '@latha/core'

function resolveTaxonomy(cms: LathaInstance, slug: string): Taxonomy {
  const entity = cms.getEntity(slug)
  if (!entity || entity.kind !== 'taxonomy') {
    throw new Error(`"${slug}" is not a taxonomy.`)
  }
  return entity
}

/** A JSON-serializable document. */
export type JsonDoc = { id: string } & Record<string, JsonValue>

export interface JsonTermNode {
  id: string
  children: JsonTermNode[]
  [key: string]: JsonValue | JsonTermNode[]
}

/** Force a value to its JSON-serializable form via a structural round-trip. */
function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export interface ContentApiOptions {
  /** Resolve (and memoize) the live CMS instance. */
  getLatha: () => Promise<LathaInstance>
  /** Resolve the current principal for access checks. Defaults to anonymous. */
  getPrincipal?: () => Promise<unknown>
  /**
   * Opt into guard enforcement (e.g. RBAC) by threading `{ enforce: true }` to
   * every operation. The admin RPC layer sets this; the public/headless path
   * leaves it off so reads stay allow-by-default.
   */
  enforce?: boolean
}

export interface ContentApi {
  list(collection: string, query?: Query): Promise<JsonDoc[]>
  findOne(collection: string, id: string): Promise<JsonDoc | null>
  create(collection: string, data: unknown): Promise<JsonDoc>
  update(collection: string, id: string, data: unknown): Promise<JsonDoc>
  remove(collection: string, id: string): Promise<void>

  getGlobal(slug: string): Promise<JsonDoc | null>
  saveGlobal(slug: string, data: unknown): Promise<JsonDoc>

  listTerms(slug: string): Promise<JsonDoc[]>
  createTerm(slug: string, data: unknown): Promise<JsonDoc>
  updateTerm(slug: string, id: string, data: unknown): Promise<JsonDoc>
  removeTerm(slug: string, id: string): Promise<void>
  tree(slug: string): Promise<JsonTermNode[]>
}

export function createContentApi(options: ContentApiOptions): ContentApi {
  const context = options.enforce ? { enforce: true } : undefined
  const ctx = async () => ({
    cms: await options.getLatha(),
    principal: (await options.getPrincipal?.()) ?? null,
    context,
  })

  const asDoc = (doc: Doc) => serialize(doc) as JsonDoc

  return {
    async list(collection, query) {
      return (await operations.find(await ctx(), collection, query)).map(asDoc)
    },
    async findOne(collection, id) {
      const doc = await operations.findOne(await ctx(), collection, id)
      return doc ? asDoc(doc) : null
    },
    async create(collection, data) {
      return asDoc(await operations.create(await ctx(), collection, data))
    },
    async update(collection, id, data) {
      return asDoc(await operations.update(await ctx(), collection, id, data))
    },
    async remove(collection, id) {
      await operations.destroy(await ctx(), collection, id)
    },

    async getGlobal(slug) {
      const doc = await operations.findGlobal(await ctx(), slug)
      return doc ? asDoc(doc) : null
    },
    async saveGlobal(slug, data) {
      return asDoc(await operations.saveGlobal(await ctx(), slug, data))
    },

    async listTerms(slug) {
      const opCtx = await ctx()
      resolveTaxonomy(opCtx.cms, slug)
      for (const guard of opCtx.cms.guards) {
        await guard({ cms: opCtx.cms, operation: 'read', slug, kind: 'taxonomy', principal: opCtx.principal ?? null, context: opCtx.context ?? {} })
      }
      const docs = await opCtx.cms.db.find(slug, { sort: [{ field: 'name', direction: 'asc' }] })
      return docs.map(asDoc)
    },
    async createTerm(slug, data) {
      const opCtx = await ctx()
      const entity = resolveTaxonomy(opCtx.cms, slug)
      for (const guard of opCtx.cms.guards) {
        await guard({ cms: opCtx.cms, operation: 'create', slug, kind: 'taxonomy', principal: opCtx.principal ?? null, data, context: opCtx.context ?? {} })
      }
      const schema = buildZodSchema(entity.fields ?? [])
      const validated = schema.parse(data) as Record<string, unknown>
      return asDoc(await opCtx.cms.db.create(slug, validated))
    },
    async updateTerm(slug, id, data) {
      const opCtx = await ctx()
      const entity = resolveTaxonomy(opCtx.cms, slug)
      for (const guard of opCtx.cms.guards) {
        await guard({ cms: opCtx.cms, operation: 'update', slug, kind: 'taxonomy', principal: opCtx.principal ?? null, data, doc: { id }, context: opCtx.context ?? {} })
      }
      const schema = buildZodSchema(entity.fields ?? []).partial()
      const validated = schema.parse(data) as Record<string, unknown>
      return asDoc(await opCtx.cms.db.update(slug, id, validated))
    },
    async removeTerm(slug, id) {
      const opCtx = await ctx()
      resolveTaxonomy(opCtx.cms, slug)
      for (const guard of opCtx.cms.guards) {
        await guard({ cms: opCtx.cms, operation: 'delete', slug, kind: 'taxonomy', principal: opCtx.principal ?? null, doc: { id }, context: opCtx.context ?? {} })
      }
      await opCtx.cms.db.delete(slug, id)
    },
    async tree(slug) {
      const opCtx = await ctx()
      resolveTaxonomy(opCtx.cms, slug)
      for (const guard of opCtx.cms.guards) {
        await guard({ cms: opCtx.cms, operation: 'read', slug, kind: 'taxonomy', principal: opCtx.principal ?? null, context: opCtx.context ?? {} })
      }
      const docs = await opCtx.cms.db.find(slug, { sort: [{ field: 'name', direction: 'asc' }] })
      const terms = docs.map(asDoc)
      const byId = new Map<string, JsonTermNode>()
      for (const term of terms) byId.set(term.id, { ...term, children: [] } as JsonTermNode)
      const roots: JsonTermNode[] = []
      for (const node of byId.values()) {
        const parentId = node.parent as string | undefined
        const parent = parentId ? byId.get(parentId) : undefined
        if (parent) parent.children.push(node)
        else roots.push(node)
      }
      return serialize(roots) as JsonTermNode[]
    },
  }
}
