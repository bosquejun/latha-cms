/**
 * AuthModule — session auth + RBAC.
 *
 * Auth owns authorization in LathaCMS. It:
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
 * the `users` collection (which `@latha/users` provides), but you can point it
 * at another collection via `usersSlug`, or supply a custom `subjectStore`
 * (e.g. an external IdP) — so auth can run standalone.
 */

import type { LathaInstance, Module } from '@latha/core'
import { DEFAULT_COOKIE_NAME } from './service.js'
import { rbacEntities } from './rbac/entities.js'
import { createRbacGuard } from './rbac/guard.js'
import { syncCatalog, getCatalog } from './rbac/catalog.js'
import { defaultRoles, seedRoles, type RoleSeed } from './rbac/seed.js'
import {
  collectionSubjectStore,
  setSubjectStore,
  type SubjectStore,
} from './subject-store.js'

export interface AuthModuleConfig {
  /** HMAC secret used to sign session tokens. */
  secret: string
  /** Session cookie name. Defaults to `latha_session`. */
  cookieName?: string
  /** Session lifetime in seconds. */
  sessionTtlSeconds?: number
  /**
   * Default roles to seed on first run (empty `roles` table). Permissions are
   * permission keys (wildcards allowed). Omit to use the built-in
   * admin/editor/viewer starter set.
   */
  roles?: RoleSeed[]
  /**
   * Collection the default subject store reads identities from. Defaults to
   * `users`. Ignored when `subjectStore` is provided.
   */
  usersSlug?: string
  /**
   * Custom identity source. Supply this to run auth without `@latha/users`
   * (e.g. an external identity provider). Overrides `usersSlug`.
   */
  subjectStore?: (latha: LathaInstance) => SubjectStore
}

export function AuthModule(config: AuthModuleConfig): Module {
  void config.secret // consumed by the app's RPC/server layer via env, kept for API symmetry
  void (config.cookieName ?? DEFAULT_COOKIE_NAME)

  return {
    name: 'auth',
    capabilities: ['auth', 'rbac'],
    entities: rbacEntities,
    admin: { nav: { area: 'settings', label: 'Access', order: 90 }, ui: '@latha/auth/admin' },

    onInit(latha) {
      // Register the identity source (custom, a configured collection, or the
      // default `users` collection).
      setSubjectStore(
        latha,
        config.subjectStore
          ? config.subjectStore(latha)
          : collectionSubjectStore(latha, config.usersSlug),
      )
      // Plug RBAC into the kernel's generic authorization seam.
      latha.registerGuard(createRbacGuard())
    },

    async onReady(latha) {
      // Sync the scope/permission catalog from the live entity set, then seed
      // the default roles if none exist yet.
      const catalog = await syncCatalog(latha)
      const roles = config.roles ?? defaultRoles(catalog)
      await seedRoles(latha, roles)
    },
  }
}

// Re-export the catalog accessor for advanced callers (e.g. custom seeds).
export { getCatalog }
