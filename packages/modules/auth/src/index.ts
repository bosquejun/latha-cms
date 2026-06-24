/**
 * @latha/auth — session-based authentication + RBAC.
 *
 * Provides the AuthModule (RBAC entities, the RBAC guard, catalog sync, default
 * role seeding), edge-friendly password hashing, signed session tokens, the
 * service helpers an app uses for login / logout / route guards, and the
 * permission helpers the framework layer uses to gate the admin surface.
 */

export { AuthModule, getCatalog, type AuthModuleConfig } from './module.js'

export type { AuthUser, AuthAdapter } from './types.js'

// Pluggable identity source — lets auth run without @latha/users.
export {
  collectionSubjectStore,
  getSubjectStore,
  setSubjectStore,
  DEFAULT_USERS_SLUG,
  type Subject,
  type SubjectStore,
} from './subject-store.js'

export { hashPassword, verifyPassword } from './crypto.js'

export {
  createSessionToken,
  verifySessionToken,
  DEFAULT_SESSION_TTL_SECONDS,
  type SessionPayload,
} from './session.js'

export {
  authenticate,
  getSessionUser,
  getUserById,
  findUserByEmail,
  toAuthUser,
  parseCookies,
  USERS_SLUG,
  DEFAULT_COOKIE_NAME,
  type AuthOptions,
} from './service.js'

// RBAC: permission helpers, catalog, entities, and seeding.
export {
  hasPermission,
  matchesPermission,
  permissionsOf,
  permissionKey,
  actionsForKind,
  ADMIN_ACCESS,
  SUPERADMIN,
} from './rbac/permissions.js'

export {
  syncCatalog,
  type RbacCatalog,
  type ScopeRecord,
  type PermissionRecord,
} from './rbac/catalog.js'

export { resolveUserPermissions, type ResolvedGrants } from './rbac/resolve.js'

export {
  defaultRoles,
  seedRoles,
  getRoleByName,
  type RoleSeed,
} from './rbac/seed.js'

export {
  rbacEntities,
  ROLES_SLUG,
  SCOPES_SLUG,
  PERMISSIONS_SLUG,
} from './rbac/entities.js'
