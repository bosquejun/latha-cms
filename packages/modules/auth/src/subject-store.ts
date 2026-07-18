/**
 * Subject store — the pluggable source of authenticatable identities.
 *
 * Auth does not depend on the users module: it resolves credentials and
 * sessions through a `SubjectStore`. The default store is backed by a CMS
 * entity (the `users` collection by default), but an app can point it at a
 * different entity (`AuthModule({ usersSlug })`) or supply a wholly custom
 * store (`AuthModule({ subjectStore })`) — e.g. an external identity provider —
 * so `@kon10/auth` can run without `@kon10/users` at all.
 *
 * The resolved store is cached per instance (set in `AuthModule.onInit`) so the
 * stateless service helpers can reach it with only a `Kon10Instance`.
 */

import { operations } from '@kon10/core'
import type { Kon10Instance } from '@kon10/core'
import { cached } from '@kon10/cache'
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

/** What first-run setup needs to mint a subject. `roles` are role ids. */
export interface CreateSubjectInput {
  email: string
  passwordHash: string
  name?: string
  roles?: string[]
  [key: string]: unknown
}

export interface SubjectStore {
  /** Find a subject by email (including the password hash), or `null`. */
  findByEmail(email: string): Promise<Subject | null>
  /** Find a subject by id (e.g. from a verified session), or `null`. */
  findById(id: string): Promise<Subject | null>
  /**
   * Total subjects — used to detect a fresh install for first-run setup.
   * Optional: a store that cannot count (e.g. an external IdP) omits it and
   * thereby opts out of the setup flow.
   */
  count?(): Promise<number>
  /**
   * Create a subject. Optional for the same reason as {@link SubjectStore.count} —
   * an external identity provider owns its own account creation, so a store
   * that omits this declines first-run setup rather than half-supporting it.
   */
  create?(input: CreateSubjectInput): Promise<Subject>
}

// Run lookups as the system principal (superadmin) so auth's own reads are
// never blocked by the RBAC guard or per-entity access predicates.
const systemCtx = (kon10: Kon10Instance) => ({
  cms: kon10,
  principal: { id: '__system__', permissions: ['*'] },
})

/**
 * A `SubjectStore` backed by a CMS entity. The entity must carry `email`,
 * `passwordHash`, and (for RBAC) `roles` fields — exactly what `@kon10/users`
 * contributes.
 */
export function entitySubjectStore(
  kon10: Kon10Instance,
  slug: string = DEFAULT_USERS_SLUG,
): SubjectStore {
  const ensure = () => {
    if (!kon10.getEntity(slug)) {
      throw new Error(
        `Auth subject store: no "${slug}" entity. Install @kon10/users, ` +
          `set AuthModule({ usersSlug }), or pass a custom AuthModule({ subjectStore }).`,
      )
    }
  }
  return {
    async findByEmail(email) {
      ensure()
      const rows = await operations.find(systemCtx(kon10), slug, {
        where: { email },
        limit: 1,
      })
      return (rows[0] as Subject | undefined) ?? null
    },
    async findById(id) {
      ensure()
      return cached(kon10, userIdKey(slug, id), AUTH_CACHE_TTL_SECONDS, async () => {
        return (await operations.findOne(systemCtx(kon10), slug, id)) as Subject | null
      })
    },
    async count() {
      ensure()
      return operations.count(systemCtx(kon10), slug)
    },
    async create(input) {
      ensure()
      return (await operations.create(systemCtx(kon10), slug, input)) as Subject
    },
  }
}

const stores = new WeakMap<Kon10Instance, SubjectStore>()

/** Register the subject store for an instance (from `AuthModule.onInit`). */
export function setSubjectStore(kon10: Kon10Instance, store: SubjectStore): void {
  stores.set(kon10, store)
}

/**
 * The subject store for an instance. Falls back to a default entity store
 * over the `users` collection if none was registered.
 */
export function getSubjectStore(kon10: Kon10Instance): SubjectStore {
  return stores.get(kon10) ?? entitySubjectStore(kon10)
}
