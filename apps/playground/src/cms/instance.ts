/**
 * Server-only CMS instance singleton.
 *
 * Bootstraps the kernel once per server process and memoizes it. Only import
 * this from server functions — it touches the database adapter and must never
 * be bundled into the client.
 */

import { bootstrapLatha, type LathaInstance } from '@latha/core'
import { lathaConfig } from './config'

let instance: Promise<LathaInstance> | null = null

export function getLatha(): Promise<LathaInstance> {
  if (!instance) instance = bootstrapLatha(lathaConfig)
  return instance
}
