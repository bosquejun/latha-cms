/**
 * @latha/auth — session-based authentication.
 *
 * Provides the AuthModule (installs the request → user adapter), edge-friendly
 * password hashing, signed session tokens, and the service helpers an app uses
 * to implement login / logout / route guards.
 */

export { AuthModule, type AuthModuleConfig } from './module.js'

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
