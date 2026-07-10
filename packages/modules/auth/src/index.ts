/**
 * @kon10/auth — session-based authentication + RBAC.
 *
 * Provides the AuthModule (RBAC entities, the RBAC guard, catalog sync, default
 * role seeding), edge-friendly password hashing, signed session tokens, the
 * service helpers an app uses for login / logout / route guards, and the
 * permission helpers the framework layer uses to gate the Studio surface.
 */

export { AuthModule, getCatalog, type AuthModuleConfig } from './module.js'

export type { AuthUser, AuthAdapter } from './types.js'

// Pluggable identity source — lets auth run without @kon10/users.
export {
  entitySubjectStore,
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
  DEFAULT_COOKIE_NAME,
  type AuthOptions,
} from './service.js'

export { resolveAuthOptions, DEV_SECRET, type ResolvedAuthOptions } from './config.js'
export { serializeSetCookie, type SetCookieOptions } from './cookie.js'
export { loginBlocked, recordLoginFailure, clearLoginFailures } from './login-throttle.js'

// The module's own HTTP endpoints (login/logout/current-user) — exported for
// introspection/testing; `AuthModule()` already wires them onto `routes`.
export {
  loginRoute,
  logoutRoute,
  currentUserRoute,
  toSessionUser,
  type SessionUser,
} from './api/index.js'

// RBAC: permission helpers, catalog, entities, and seeding.
export {
  hasPermission,
  matchesPermission,
  permissionsOf,
  permissionKey,
  STUDIO_ACCESS,
  SUPERADMIN,
  PUBLIC_ROLE,
  AUTHENTICATED_ROLE,
} from './rbac/permissions.js'

export {
  syncCatalog,
  type RbacCatalog,
  type ScopeRecord,
  type PermissionRecord,
} from './rbac/catalog.js'

export {
  resolveUserPermissions,
  resolveRoleGrants,
  getPublicPrincipal,
  getRolePermissions,
  type ResolvedGrants,
  type PublicPrincipal,
} from './rbac/resolve.js'

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

// API keys — bearer credentials for headless/machine consumers.
export { apiKeysEntity, API_KEYS_SLUG } from './api-keys/entities.js'
export {
  createApiKey,
  verifyApiKeyToken,
  type ApiKeyPrincipal,
  type CreateApiKeyInput,
} from './api-keys/service.js'
export {
  API_KEY_TOKEN_PREFIX,
  apiKeyDisplayPrefix,
  generateApiKeyToken,
  hashApiKeyToken,
} from './api-keys/token.js'
