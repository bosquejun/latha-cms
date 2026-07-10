/**
 * Subject store — the pluggable source of authenticatable identities.
 *
 * Auth does not depend on the users module: it resolves credentials and
 * sessions through a `SubjectStore`. The default store is backed by a CMS
 * entity (the `users` collection by default), but an app can point it at a
 * different entity (`AuthModule({ usersSlug })`) or supply a wholly custom
 * store (`AuthModule({ subjectStore })`) — e.g. an external identity provider —
 * so `@latha/auth` can run without `@latha/users` at all.
 *
 * The resolved store is cached per instance (set in `AuthModule.onInit`) so the
 * stateless service helpers can reach it with only a `LathaInstance`.
 */

import { operations } from '@latha/core'
import type { LathaInstance } from '@latha/core'
import { cached } from '@latha/cache'
import { AUTH_CACHE_TTL_SECONDS, userIdKey } from './cache.js'

/** The default entity slug a subject store reads from. */
export const DEFAULT_USERS_SLUG = 'users'

/**
 * A stored identity. Carries at least an `id`; `passwordHash` is required for
 * local (password) login, and `roles` (role ids) feed RBAC resolution.
 */
export interface Subject {
  id: string
  passwordHash?: string | null
  roles?: string[]
  [key: string]: unknown
}

export interface SubjectStore {
  /** Find a subject by email (including the password hash), or `null`. */
  findByEmail(email: string): Promise<Subject | null>
  /** Find a subject by id (e.g. from a verified session), or `null`. */
  findById(id: string): Promise<Subject | null>
}

// Run lookups as the system principal (superadmin) so auth's own reads are
// never blocked by the RBAC guard or per-entity access predicates.
const systemCtx = (latha: LathaInstance) => ({
  cms: latha,
  principal: { id: '__system__', permissions: ['*'] },
})

/**
 * A `SubjectStore` backed by a CMS entity. The entity must carry `email`,
 * `passwordHash`, and (for RBAC) `roles` fields — exactly what `@latha/users`
 * contributes.
 */
export function entitySubjectStore(
  latha: LathaInstance,
  slug: string = DEFAULT_USERS_SLUG,
): SubjectStore {
  const ensure = () => {
    if (!latha.getEntity(slug)) {
      throw new Error(
        `Auth subject store: no "${slug}" entity. Install @latha/users, ` +
          `set AuthModule({ usersSlug }), or pass a custom AuthModule({ subjectStore }).`,
      )
    }
  }
  return {
    async findByEmail(email) {
      ensure()
      const rows = await operations.find(systemCtx(latha), slug, {
        where: { email },
        limit: 1,
      })
      return (rows[0] as Subject | undefined) ?? null
    },
    async findById(id) {
      ensure()
      return cached(latha, userIdKey(slug, id), AUTH_CACHE_TTL_SECONDS, async () => {
        return (await operations.findOne(systemCtx(latha), slug, id)) as Subject | null
      })
    },
  }
}

const stores = new WeakMap<LathaInstance, SubjectStore>()

/** Register the subject store for an instance (from `AuthModule.onInit`). */
export function setSubjectStore(latha: LathaInstance, store: SubjectStore): void {
  stores.set(latha, store)
}

/**
 * The subject store for an instance. Falls back to a default entity store
 * over the `users` collection if none was registered.
 */
export function getSubjectStore(latha: LathaInstance): SubjectStore {
  return stores.get(latha) ?? entitySubjectStore(latha)
}
