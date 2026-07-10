import { z } from 'zod'
import type { Kon10Instance, Module, StorageAdapter } from '@kon10/core'
import { buildMediaEntity } from './entities.js'
import { uploadRoute } from './upload.js'

export interface MediaModuleConfig {
  /** Where uploaded files are stored (e.g. `localDiskStorage()`, an R2/S3 adapter). */
  storage: StorageAdapter
  /**
   * Maximum upload size in bytes, enforced server-side before any bytes reach
   * storage. Defaults to 20 MiB.
   */
  maxFileSize?: number
  /**
   * MIME types accepted for upload — exact (`application/pdf`) or wildcard
   * (`image/*`). Defaults to images, video, audio, and PDFs. Note this checks
   * the declared content type, not the bytes.
   */
  allowedMimeTypes?: string[]
}

export function MediaModule(config: MediaModuleConfig): Module {
  return {
    name: 'media',
    capabilities: ['media'],
    studio: { nav: { label: 'Media', order: 25 }, ui: '@kon10/media/studio' },
    entities: [
      buildMediaEntity({
        maxFileSize: config.maxFileSize,
        allowedMimeTypes: config.allowedMimeTypes,
      }),
    ],
    routes: { upload: uploadRoute },
    onInit(cms: Kon10Instance) {
      cms.registerStorageAdapter(config.storage)
      cms.registerFieldType({
        configSchema: z.object({ type: z.literal('media') }),
        buildDataSchema: () => z.string(),
      })
    },
  }
}
