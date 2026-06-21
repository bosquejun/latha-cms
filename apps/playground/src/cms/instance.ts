/**
 * Server-only CMS instance singleton.
 *
 * Bootstraps the kernel once per server process and memoizes it. Only import
 * this from server functions — it touches the database adapter and must never
 * be bundled into the client.
 */

import { bootstrapCMS, type CMSInstance } from '@latha/core'
import { cmsConfig } from './config'

let instance: Promise<CMSInstance> | null = null

export function getCMS(): Promise<CMSInstance> {
  if (!instance) instance = bootstrapCMS(cmsConfig)
  return instance
}
