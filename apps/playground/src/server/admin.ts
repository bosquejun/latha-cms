/**
 * Admin metadata server functions.
 *
 * The admin shell is registry-driven: the sidebar nav and per-entity form/list
 * descriptors come straight from the kernel's `cms.entities` via the pure
 * helpers in `@latha/admin-sdk`. Field definitions are plain data, so they
 * serialize cleanly; we wrap the entity descriptor as a `JsonValue` to satisfy
 * the server-fn serialization checker and cast it back on the client.
 */

import { createServerFn } from '@tanstack/react-start'
import type { JsonValue } from '@latha/core'
import { buildNav, describeEntity, type AdminNavItem } from '@latha/admin-sdk'
import { getLatha } from '../cms/instance'

export const getNav = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminNavItem[]> => {
    const cms = await getLatha()
    return buildNav(cms.entities)
  },
)

export const getEntitySchema = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<{ entity: JsonValue | null }> => {
    const cms = await getLatha()
    const entity = cms.getEntity(slug)
    if (!entity) return { entity: null }
    return { entity: describeEntity(entity) as unknown as JsonValue }
  })
