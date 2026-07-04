import { z } from 'zod'
import type { LathaInstance, Module } from '@latha/core'
import { buildMediaEntity } from './entities.js'

export interface MediaModuleConfig {}

export function MediaModule(_config: MediaModuleConfig = {}): Module {
  return {
    name: 'media',
    capabilities: ['media'],
    admin: { nav: { label: 'Media', order: 25 }, ui: '@latha/media/admin' },
    entities: [buildMediaEntity()],
    onInit(cms: LathaInstance) {
      if (!cms.storage) {
        throw new Error(
          '[latha] MediaModule requires a storage adapter — pass `storage` to defineConfig().',
        )
      }
      cms.registerFieldType({
        configSchema: z.object({ type: z.literal('media') }),
        buildDataSchema: () => z.string(),
      })
    },
  }
}
