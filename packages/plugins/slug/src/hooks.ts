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
 *   explicit admin affordance that submits a new value.
 * - uniqueness: `-2`, `-3`… suffixes on collision, excluding the doc itself
 *   on update. The DB UNIQUE column stays as the concurrent-write backstop.
 *
 * Naming: `entitySlug` is the entity's slug ('posts'); `slugField` names the
 * document field. `HookArgs.slug` is always the *entity* slug.
 */

import type { DBAdapter, HookFn } from '@latha/core'
import { slugifyPath } from './slugify.js'
import { resolveTokens, type SlugToken } from './template.js'

export interface SlugHookTarget {
  /** The slug field's name on the document. */
  name: string
  /** Compiled template tokens (see template.ts). */
  tokens: SlugToken[]
  maxLength?: number
}

const MAX_SUFFIX_ATTEMPTS = 50

function truncate(base: string, maxLength: number | undefined): string {
  if (maxLength === undefined || base.length <= maxLength) return base
  return base.slice(0, maxLength).replace(/[-/]+$/, '')
}

/**
 * Return `base` or the first free `base-n` in `entitySlug.slugField`,
 * treating a hit on `selfId` as free. Bounded: after 50 attempts, falls back
 * to a base36-timestamp suffix rather than looping forever.
 */
export async function ensureUniqueSlug(
  db: DBAdapter,
  entitySlug: string,
  slugField: string,
  base: string,
  selfId?: string,
  maxLength?: number,
): Promise<string> {
  for (let n = 1; n <= MAX_SUFFIX_ATTEMPTS; n++) {
    const suffix = n === 1 ? '' : `-${n}`
    const candidate =
      truncate(base, maxLength === undefined ? undefined : maxLength - suffix.length) +
      suffix
    const [hit] = await db.find(entitySlug, {
      where: { [slugField]: candidate },
      limit: 1,
    })
    if (!hit || hit.id === selfId) return candidate
  }
  return `${truncate(base, maxLength === undefined ? undefined : maxLength - 8)}-${Date.now().toString(36)}`
}

/** Build the beforeCreate/beforeUpdate hooks for one entity's slug fields. */
export function createSlugHooks(
  db: DBAdapter,
  entitySlug: string,
  targets: SlugHookTarget[],
): { beforeCreate: HookFn; beforeUpdate: HookFn } {
  async function baseFor(
    target: SlugHookTarget,
    data: Record<string, unknown>,
    previousDoc?: Record<string, unknown>,
  ): Promise<string> {
    const manual = data[target.name]
    if (typeof manual === 'string' && manual.trim() !== '') {
      return slugifyPath(manual)
    }
    return slugifyPath(await resolveTokens(target.tokens, { data, previousDoc, db }))
  }

  const beforeCreate: HookFn = async ({ data }) => {
    let next = data
    for (const target of targets) {
      const base = await baseFor(target, next)
      if (base === '') continue // nothing to derive — leave unset for manual entry
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

  return { beforeCreate, beforeUpdate }
}
