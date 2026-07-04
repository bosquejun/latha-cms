import { z } from 'zod'
import type { LathaInstance, Module, StorageAdapter } from '@latha/core'
import { buildMediaEntity } from './entities.js'

export interface MediaModuleConfig {
  /** Where uploaded files are stored (e.g. `localDiskStorage()`, an R2/S3 adapter). */
  storage: StorageAdapter
}

export function MediaModule(config: MediaModuleConfig): Module {
  return {
    name: 'media',
    capabilities: ['media'],
    admin: { nav: { label: 'Media', order: 25 }, ui: '@latha/media/admin' },
    entities: [buildMediaEntity()],
    onInit(cms: LathaInstance) {
      cms.registerStorageAdapter(config.storage)
      cms.registerFieldType({
        configSchema: z.object({ type: z.literal('media') }),
        buildDataSchema: () => z.string(),
      })
    },
  }
}
