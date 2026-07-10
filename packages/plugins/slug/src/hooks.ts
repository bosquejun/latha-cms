/**
 * Slug generation/uniqueness hooks, created per entity by `slugPlugin`.
 *
 * Injected hooks close over the `DBAdapter` (kernel `HookArgs` carries no db
 * access) and are unshifted ahead of user hooks so user-authored hooks always
 * observe the final slug value.
 *
 * Semantics:
 * - create: a manual non-empty value wins (normalized); otherwise the value
 *   is resolved from the template. An empty result leaves the field unset.
 * - update: untouched unless the payload carries the slug key — retitling a
 *   published post never silently rewrites its URL. Regeneration is an
 *   explicit Studio affordance that submits a new value.
 * - uniqueness: `-2`, `-3`… suffixes on collision, excluding the doc itself
 *   on update. The DB UNIQUE column stays as the concurrent-write backstop.
 *
 * Nested mode (`SlugHookTarget.nested`) layers on top:
 * - the slug field stores a single leaf segment; the plugin-owned path field
 *   stores `ancestor-segments.../leaf`, recomputed whenever the payload
 *   touches the slug *or* the parent field (moving a page updates its URL
 *   even though the slug key is absent).
 * - uniqueness is enforced on the full path (leaf unique among siblings,
 *   path globally unique by construction) — the UNIQUE column lives on the
 *   path field.
 * - the parent chain is walked from the doc's own leaf segments (cycle- and
 *   dangling-pointer-guarded), and `afterUpdate` cascades a changed path to
 *   all descendants via the db directly — the path field is derived, so the
 *   cascade must not re-enter entity hooks.
 *
 * Naming: `entitySlug` is the entity's slug ('posts'); `slugField` names the
 * document field. `HookArgs.slug` is always the *entity* slug.
 */

import type { DBAdapter, HookFn } from '@kon10/core'
import { slugify, slugifyPath } from './slugify.js'
import { resolveTokens, type SlugToken } from './template.js'

export interface SlugNestedTarget {
  /** Sibling relationship field naming the parent document. */
  parentField: string
  /** Plugin-owned field storing the derived full path. */
  pathField: string
}

export interface SlugHookTarget {
  /** The slug field's name on the document. */
  name: string
  /** Compiled template tokens (see template.ts). */
  tokens: SlugToken[]
  maxLength?: number
  /** Nested-page mode (see module docs). Resolved by `slugPlugin` at onInit. */
  nested?: SlugNestedTarget
}

/**
 * Collision scope for `ensureUniqueSlug`: check candidates against
 * `field = prefix + candidate` instead of the slug field itself. Nested mode
 * scopes leaf uniqueness to siblings by checking the derived full path.
 */
export interface SlugUniqueScope {
  field: string
  prefix: string
}

const MAX_SUFFIX_ATTEMPTS = 50

function truncate(base: string, maxLength: number | undefined): string {
  if (maxLength === undefined || base.length <= maxLength) return base
  return base.slice(0, maxLength).replace(/[-/]+$/, '')
}

/**
 * Return `base` or the first free `base-n` in `entitySlug.slugField`,
 * treating a hit on `selfId` as free. With a `scope`, collisions are checked
 * on `scope.field` against `scope.prefix + candidate` (still returning the
 * bare candidate). Bounded: after 50 attempts, falls back to a
 * base36-timestamp suffix rather than looping forever.
 */
export async function ensureUniqueSlug(
  db: DBAdapter,
  entitySlug: string,
  slugField: string,
  base: string,
  selfId?: string,
  maxLength?: number,
  scope?: SlugUniqueScope,
): Promise<string> {
  const checkField = scope?.field ?? slugField
  const prefix = scope?.prefix ?? ''
  for (let n = 1; n <= MAX_SUFFIX_ATTEMPTS; n++) {
    const suffix = n === 1 ? '' : `-${n}`
    const candidate =
      truncate(base, maxLength === undefined ? undefined : maxLength - suffix.length) +
      suffix
    const [hit] = await db.find(entitySlug, {
      where: { [checkField]: prefix + candidate },
      limit: 1,
    })
    if (!hit || hit.id === selfId) return candidate
  }
  return `${truncate(base, maxLength === undefined ? undefined : maxLength - 8)}-${Date.now().toString(36)}`
}

/** First id of a single/many reference value, or undefined when unset. */
function refId(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  if (first == null || first === '') return undefined
  return String(first)
}

/**
 * Walk the parent chain upward from `parentId`, returning the joined path of
 * ancestor leaf segments (root first). Rebuilt from each ancestor's own slug
 * field rather than trusting stored paths, so the result is correct even when
 * an ancestor's stored path predates the plugin. Throws on a chain that
 * reaches `selfId` (re-parenting under the doc's own descendant), revisits a
 * node (pre-existing cycle), or dangles (parent id with no document).
 */
export async function resolveAncestorPath(
  db: Pick<DBAdapter, 'findOne'>,
  entitySlug: string,
  slugField: string,
  parentField: string,
  parentId: string,
  selfId?: string,
): Promise<string> {
  const segments: string[] = []
  const seen = new Set<string>()
  let id: string | undefined = parentId
  while (id !== undefined) {
    if (id === selfId) {
      throw new Error(
        `Invalid parent for "${entitySlug}/${selfId}": a page cannot be nested under itself or its own descendant.`,
      )
    }
    if (seen.has(id)) {
      throw new Error(`Parent chain in "${entitySlug}" contains a cycle at "${id}".`)
    }
    seen.add(id)
    const doc = await db.findOne(entitySlug, id)
    if (!doc) {
      throw new Error(`Parent "${entitySlug}/${id}" referenced by "${parentField}" does not exist.`)
    }
    const leaf = doc[slugField]
    if (typeof leaf === 'string' && leaf !== '') segments.unshift(leaf)
    id = refId(doc[parentField])
  }
  return segments.join('/')
}

/**
 * Rewrite the stored paths of every descendant of `rootId` to hang off
 * `rootPath`, breadth-first. Writes go through the db directly — the path
 * field is plugin-derived, so descendants' own entity hooks must not re-run.
 * A visited set makes the walk terminate even on (invalid) cyclic data.
 */
export async function cascadeDescendantPaths(
  db: DBAdapter,
  entitySlug: string,
  target: SlugHookTarget & { nested: SlugNestedTarget },
  rootId: string,
  rootPath: string,
): Promise<void> {
  const { parentField, pathField } = target.nested
  const queue: Array<{ id: string; path: string }> = [{ id: rootId, path: rootPath }]
  const visited = new Set([rootId])
  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    const children = await db.find(entitySlug, { where: { [parentField]: id } })
    for (const child of children) {
      if (visited.has(child.id)) continue
      visited.add(child.id)
      const leaf = child[target.name]
      // A child with no leaf segment has no derivable path — skip its subtree.
      if (typeof leaf !== 'string' || leaf === '') continue
      const childPath = `${path}/${leaf}`
      if (child[pathField] !== childPath) {
        await db.update(entitySlug, child.id, { [pathField]: childPath })
      }
      queue.push({ id: child.id, path: childPath })
    }
  }
}

/** Build the beforeCreate/beforeUpdate/afterUpdate hooks for one entity's slug fields. */
export function createSlugHooks(
  db: DBAdapter,
  entitySlug: string,
  targets: SlugHookTarget[],
): { beforeCreate: HookFn; beforeUpdate: HookFn; afterUpdate?: HookFn } {
  async function baseFor(
    target: SlugHookTarget,
    data: Record<string, unknown>,
    previousDoc?: Record<string, unknown>,
  ): Promise<string> {
    // Nested slugs are single segments — fold any `/` a template or manual
    // value produces into hyphens instead of keeping path structure.
    const fold = target.nested ? slugify : slugifyPath
    const manual = data[target.name]
    if (typeof manual === 'string' && manual.trim() !== '') {
      return fold(manual)
    }
    return fold(await resolveTokens(target.tokens, { data, previousDoc, db }))
  }

  /** Drop a client-sent value for the plugin-owned path field. */
  function stripPath(
    data: Record<string, unknown>,
    nested: SlugNestedTarget,
  ): Record<string, unknown> {
    if (!(nested.pathField in data)) return data
    const { [nested.pathField]: _ignored, ...rest } = data
    return rest
  }

  async function prefixFor(
    parentValue: unknown,
    slugField: string,
    nested: SlugNestedTarget,
    selfId?: string,
  ): Promise<string> {
    const parentId = refId(parentValue)
    if (parentId === undefined) return ''
    const ancestors = await resolveAncestorPath(
      db,
      entitySlug,
      slugField,
      nested.parentField,
      parentId,
      selfId,
    )
    return ancestors === '' ? '' : `${ancestors}/`
  }

  const nestedTargets = targets.filter(
    (t): t is SlugHookTarget & { nested: SlugNestedTarget } => t.nested !== undefined,
  )

  const beforeCreate: HookFn = async ({ data }) => {
    let next = data
    for (const target of targets) {
      if (target.nested) next = stripPath(next, target.nested)
      const base = await baseFor(target, next)
      if (base === '') continue // nothing to derive — leave unset for manual entry
      if (target.nested) {
        const prefix = await prefixFor(next[target.nested.parentField], target.name, target.nested)
        const leaf = await ensureUniqueSlug(db, entitySlug, target.name, base, undefined, target.maxLength, {
          field: target.nested.pathField,
          prefix,
        })
        next = { ...next, [target.name]: leaf, [target.nested.pathField]: prefix + leaf }
        continue
      }
      next = {
        ...next,
        [target.name]: await ensureUniqueSlug(
          db,
          entitySlug,
          target.name,
          base,
          undefined,
          target.maxLength,
        ),
      }
    }
    return next
  }

  const beforeUpdate: HookFn = async ({ data, previousDoc }) => {
    let next = data
    for (const target of targets) {
      if (target.nested) {
        const { parentField, pathField } = target.nested
        next = stripPath(next, target.nested)
        // Recompute when the payload touches the slug *or* the parent —
        // moving a page changes its URL even with the slug key absent.
        const touchesSlug = target.name in next
        const touchesParent = parentField in next
        if (!touchesSlug && !touchesParent) continue
        const previousLeaf = previousDoc?.[target.name]
        const base = touchesSlug
          ? await baseFor(target, next, previousDoc)
          : typeof previousLeaf === 'string'
            ? previousLeaf
            : ''
        if (base === '') continue
        const selfId = typeof previousDoc?.id === 'string' ? previousDoc.id : undefined
        const prefix = await prefixFor(
          touchesParent ? next[parentField] : previousDoc?.[parentField],
          target.name,
          target.nested,
          selfId,
        )
        if (base === previousLeaf && prefix + base === previousDoc?.[pathField]) {
          next = { ...next, [target.name]: base, [pathField]: prefix + base }
          continue // unchanged — skip the db check
        }
        const leaf = await ensureUniqueSlug(db, entitySlug, target.name, base, selfId, target.maxLength, {
          field: pathField,
          prefix,
        })
        next = { ...next, [target.name]: leaf, [pathField]: prefix + leaf }
        continue
      }
      if (!(target.name in next)) continue // slug stability: absent key = untouched
      const base = await baseFor(target, next, previousDoc)
      if (base === '') continue
      if (base === previousDoc?.[target.name]) {
        next = { ...next, [target.name]: base } // unchanged — skip the db check
        continue
      }
      next = {
        ...next,
        [target.name]: await ensureUniqueSlug(
          db,
          entitySlug,
          target.name,
          base,
          typeof previousDoc?.id === 'string' ? previousDoc.id : undefined,
          target.maxLength,
        ),
      }
    }
    return next
  }

  if (nestedTargets.length === 0) return { beforeCreate, beforeUpdate }

  // Cascade a changed path to descendants once the doc itself is saved.
  const afterUpdate: HookFn = async ({ data, previousDoc }) => {
    const id = typeof data.id === 'string' ? data.id : undefined
    if (id === undefined) return data
    for (const target of nestedTargets) {
      const newPath = data[target.nested.pathField]
      if (typeof newPath !== 'string' || newPath === previousDoc?.[target.nested.pathField]) {
        continue
      }
      await cascadeDescendantPaths(db, entitySlug, target, id, newPath)
    }
    return data
  }

  return { beforeCreate, beforeUpdate, afterUpdate }
}
