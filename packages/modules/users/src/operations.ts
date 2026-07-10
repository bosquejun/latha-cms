/**
 * User operations — thin helpers over the kernel's local API for the `users`
 * collection. Hashing is the caller's responsibility (see `@kon10/auth`); these
 * helpers persist a `passwordHash` and never see a plaintext password.
 */

import { operations } from '@kon10/core'
import type { Doc, Kon10Instance } from '@kon10/core'
import { USERS_SLUG } from './module.js'

const systemCtx = (kon10: Kon10Instance) => ({
  cms: kon10,
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
  kon10: Kon10Instance,
  input: CreateUserInput,
): Promise<Doc> {
  return operations.create(systemCtx(kon10), USERS_SLUG, input)
}

/** Total number of users — handy for first-run seeding. */
export function countUsers(kon10: Kon10Instance): Promise<number> {
  return kon10.db.count(USERS_SLUG)
}

export async function listUsers(kon10: Kon10Instance): Promise<Doc[]> {
  const rows = await operations.find(systemCtx(kon10), USERS_SLUG)
  return rows.map(({ passwordHash: _, ...rest }) => rest as Doc)
}
