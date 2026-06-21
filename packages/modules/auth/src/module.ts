/**
 * AuthModule — wires session-based auth into the kernel.
 *
 * On init it installs an `AuthAdapter` on the instance (`latha.auth`) that
 * resolves the current user from the request's session cookie. Login/logout
 * are performed by the app using the exported service helpers; this module is
 * what lets the rest of the kernel ask "who is this request?".
 *
 * Depends on the `users` module so the `users` collection exists first.
 */

import type { Module } from '@latha/core'
import { DEFAULT_COOKIE_NAME, getSessionUser } from './service.js'

export interface AuthModuleConfig {
  /** HMAC secret used to sign session tokens. */
  secret: string
  /** Session cookie name. Defaults to `latha_session`. */
  cookieName?: string
  /** Session lifetime in seconds. */
  sessionTtlSeconds?: number
}

export function AuthModule(config: AuthModuleConfig): Module {
  const options = {
    secret: config.secret,
    cookieName: config.cookieName ?? DEFAULT_COOKIE_NAME,
    sessionTtlSeconds: config.sessionTtlSeconds,
  }

  return {
    name: 'auth',
    dependsOn: ['users'],
    capabilities: ['auth'],
    onInit(latha) {
      latha.auth = {
        getUser: (request) => getSessionUser(request, options, latha),
      }
    },
  }
}
