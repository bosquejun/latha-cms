/**
 * The client-facing session shape — a stripped-down `AuthUser` safe to put on
 * the wire. Duck-typed rather than imported from `@kon10/studio-sdk` (an
 * optional peer dependency here): the JSON wire format is what actually
 * enforces the contract, not the type import.
 */
import type { AuthUser } from '../types.js'

export interface SessionUser {
  id: string
  email: string | null
  name: string | null
  roles: string[]
  permissions: string[]
}

export function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    roles: user.roles ?? [],
    permissions: user.permissions ?? [],
  }
}
