/**
 * Server-only Latha instance singleton.
 *
 * Bootstraps the kernel once per server process, memoizes it, and seeds a
 * first-run admin user so the login flow is usable out of the box. Only import
 * this from server functions — it touches the database adapter and must never
 * be bundled into the client.
 */

import { bootstrapLatha, type LathaInstance } from '@latha/core'
import { hashPassword } from '@latha/auth'
import { countUsers, createUser } from '@latha/users'
import { lathaConfig } from './config'

const SEED_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@latha.dev'
const SEED_PASSWORD = process.env.ADMIN_PASSWORD ?? 'password'

let instance: Promise<LathaInstance> | null = null

async function boot(): Promise<LathaInstance> {
  const latha = await bootstrapLatha(lathaConfig)

  // First-run seed: create an admin so login works out of the box.
  if ((await countUsers(latha)) === 0) {
    await createUser(latha, {
      email: SEED_EMAIL,
      name: 'Admin',
      role: 'admin',
      passwordHash: await hashPassword(SEED_PASSWORD),
    })
    console.log(`[latha] seeded admin user: ${SEED_EMAIL} / ${SEED_PASSWORD}`)
  }

  return latha
}

export function getLatha(): Promise<LathaInstance> {
  if (!instance) instance = boot()
  return instance
}
