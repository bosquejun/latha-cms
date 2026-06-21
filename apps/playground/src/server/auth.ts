/**
 * Auth server functions — login, logout, and current-user resolution.
 *
 * These are client-importable (the client gets RPC stubs), so the actual
 * cookie/session work lives in the server-only `cms/session` module, loaded via
 * dynamic `import()` inside each handler. The client only ever receives the
 * serializable `SessionUser` projection (never the raw `AuthUser`, whose
 * `unknown` index signature isn't serializable).
 */

import { createServerFn } from '@tanstack/react-start'
import type { AuthUser } from '@latha/core'

export interface SessionUser {
  id: string
  email: string | null
  name: string | null
  role: string | null
}

function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    email: (user.email as string | undefined) ?? null,
    name: (user.name as string | undefined) ?? null,
    role: user.role ?? null,
  }
}

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const { currentAuthUser } = await import('../cms/session')
    const user = await currentAuthUser()
    return user ? toSessionUser(user) : null
  },
)

export const loginFn = createServerFn({ method: 'POST' })
  .validator((data: { email: string; password: string }) => data)
  .handler(
    async ({ data }): Promise<{ ok: boolean; user: SessionUser | null }> => {
      const { signIn } = await import('../cms/session')
      const user = await signIn(data.email, data.password)
      return { ok: !!user, user: user ? toSessionUser(user) : null }
    },
  )

export const logoutFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ ok: true }> => {
    const { signOut } = await import('../cms/session')
    signOut()
    return { ok: true }
  },
)
