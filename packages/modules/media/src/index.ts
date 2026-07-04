/**
 * @latha/media — MediaModule, storage adapters, and the media field type.
 */

import type { BaseFieldConfig } from '@latha/core'

// Augment core's FieldTypeMap so consumers get the media field type.
declare module '@latha/core' {
  interface FieldTypeMap {
    media: BaseFieldConfig & { type: 'media' }
  }
}

export { localDiskStorage, type LocalDiskStorageOptions } from './storage/local-disk.js'
export { s3Storage, type S3StorageOptions } from './storage/s3.js'
export { media } from './builders.js'
export { MediaModule, type MediaModuleConfig } from './module.js'
export { MEDIA_SLUG, buildMediaEntity } from './entities.js'
