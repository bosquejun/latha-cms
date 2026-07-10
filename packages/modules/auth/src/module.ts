/**
 * AuthModule — session auth + RBAC.
 *
 * Auth owns authorization in Kon10. It:
 *   - contributes the `roles` / `scopes` / `permissions` entities,
 *   - registers an RBAC guard into the kernel's generic guard seam (`onInit`),
 *   - registers a `SubjectStore` (the pluggable identity source) (`onInit`),
 *   - syncs the scope/permission catalog from the live config and seeds default
 *     roles on first run (`onReady`).
 *
 * The kernel itself knows nothing about users, roles, or permissions — it only
 * runs the guard and threads an opaque principal. Login/logout are performed by
 * the app via the exported service helpers.
 *
 * Auth does NOT depend on the users module. By default it reads identities from
 * the `users` collection (which `@kon10/users` provides), but you can point it
 * at another entity via `usersSlug`, or supply a custom `subjectStore`
 * (e.g. an external IdP) — so auth can run standalone.
 */

import type { Kon10Instance, Module } from '@kon10/core'
import { invalidate } from '@kon10/cache'
import { userIdKey } from './cache.js'
import { DEFAULT_COOKIE_NAME } from './service.js'
import { apiKeysEntity } from './api-keys/entities.js'
import { rbacEntities } from './rbac/entities.js'
import { createRbacGuard } from './rbac/guard.js'
import { syncCatalog, getCatalog } from './rbac/catalog.js'
import { defaultRoles, seedRoles, type RoleSeed } from './rbac/seed.js'
import { loginRoute, logoutRoute, currentUserRoute } from './api/index.js'
import {
  entitySubjectStore,
  setSubjectStore,
  DEFAULT_USERS_SLUG,
  type SubjectStore,
} from './subject-store.js'

export interface AuthModuleConfig {
  /** HMAC secret used to sign session tokens. */
  secret: string
  /** Session cookie name. Defaults to `kon10_session`. */
  cookieName?: string
  /** Session lifetime in seconds. */
  sessionTtlSeconds?: number
  /**
   * Default roles to seed on first run (empty `roles` table). Permissions are
   * permission keys (wildcards allowed). Omit to use the built-in
   * admin/editor/viewer starter set (see `defaultRoles` in `rbac/seed.ts`).
   */
  roles?: RoleSeed[]
  /**
   * Entity slug the default subject store reads identities from. Defaults to
   * `users`. Ignored when `subjectStore` is provided.
   */
  usersSlug?: string
  /**
   * Custom identity source. Supply this to run auth without `@kon10/users`
   * (e.g. an external identity provider). Overrides `usersSlug`.
   */
  subjectStore?: (kon10: Kon10Instance) => SubjectStore
}

export function AuthModule(config: AuthModuleConfig): Module {
  // `secret`/`cookieName`/`sessionTtlSeconds` are resolved from the environment
  // at request time (`resolveAuthOptions()`, shared with `@kon10/start`'s
  // principal resolution) — kept here for API symmetry with the rest of the
  // config, not read directly.
  void config.secret
  void (config.cookieName ?? DEFAULT_COOKIE_NAME)

  return {
    name: 'auth',
    capabilities: ['auth', 'rbac'],
    entities: [...rbacEntities, apiKeysEntity],
    studio: { nav: { area: 'settings', label: 'Access', order: 90 }, ui: '@kon10/auth/studio' },
    routes: {
      login: loginRoute,
      logout: logoutRoute,
      'current-user': currentUserRoute,
    },

    onInit(kon10) {
      // Register the identity source (custom, a configured entity, or the
      // default `users` collection).
      setSubjectStore(
        kon10,
        config.subjectStore
          ? config.subjectStore(kon10)
          : entitySubjectStore(kon10, config.usersSlug),
      )
      // Plug RBAC into the kernel's generic authorization seam.
      kon10.registerGuard(createRbacGuard())

      // Invalidate the cached subject doc the moment it changes, so a
      // deactivated/edited account never keeps resolving from a stale cache
      // entry. Only possible for the built-in entity-backed store — a custom
      // `subjectStore` has no entity for `@kon10/auth` to hook into, so it's
      // left uncached beyond the defense-in-depth TTL.
      if (!config.subjectStore) {
        const usersSlug = config.usersSlug ?? DEFAULT_USERS_SLUG
        const usersEntity = kon10.getEntity(usersSlug)
        if (usersEntity) {
          const invalidateUser = async ({
            data,
            cms,
          }: {
            data: Record<string, unknown>
            cms: Kon10Instance
          }) => {
            await invalidate(cms, userIdKey(usersSlug, String(data.id)))
            return data
          }
          usersEntity.hooks ??= {}
          ;(usersEntity.hooks.afterUpdate ??= []).push(invalidateUser)
          ;(usersEntity.hooks.afterDelete ??= []).push(invalidateUser)
        }
      }
    },

    async onReady(kon10) {
      // Sync the scope/permission catalog from the live entity set, then seed
      // the default roles if none exist yet.
      const catalog = await syncCatalog(kon10)
      // Protect the identity store from default editor/viewer grants. When a
      // custom subjectStore is supplied we don't know the slug (it may not be a
      // CMS entity), so nothing extra is withheld; the app can pass `roles`
      // explicitly if it needs to protect additional scopes.
      const identitySlugs = config.subjectStore
        ? []
        : [config.usersSlug ?? DEFAULT_USERS_SLUG]
      const roles = config.roles ?? defaultRoles(catalog, identitySlugs)
      await seedRoles(kon10, roles)
    },
  }
}

// Re-export the catalog accessor for advanced callers (e.g. custom seeds).
export { getCatalog }
