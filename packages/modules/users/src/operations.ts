/**
 * User operations — thin helpers over the kernel's local API for the `users`
 * collection. Hashing is the caller's responsibility (see `@latha/auth`); these
 * helpers persist a `passwordHash` and never see a plaintext password.
 */

import { operations } from '@latha/core'
import type { Doc, LathaInstance } from '@latha/core'
import { USERS_SLUG } from './module.js'

const systemCtx = (latha: LathaInstance) => ({
  cms: latha,
  principal: { id: '__system__', permissions: ['*'] },
})

export interface CreateUserInput {
  email: string
  passwordHash: string
  name?: string
  /** Role ids assigned to the user. */
  roles?: string[]
  [key: string]: unknown
}

/** Create a user with an already-hashed password. */
export function createUser(
  latha: LathaInstance,
  input: CreateUserInput,
): Promise<Doc> {
  return operations.create(systemCtx(latha), USERS_SLUG, input)
}

/** Total number of users — handy for first-run seeding. */
export function countUsers(latha: LathaInstance): Promise<number> {
  return latha.db.count(USERS_SLUG)
}

export async function listUsers(latha: LathaInstance): Promise<Doc[]> {
  const rows = await operations.find(systemCtx(latha), USERS_SLUG)
  return rows.map(({ passwordHash: _, ...rest }) => rest as Doc)
}
