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
export { uploadRoute } from './upload.js'
export {
  MEDIA_SLUG,
  buildMediaEntity,
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_ALLOWED_MIME_TYPES,
  type MediaEntity,
  type UploadPolicy,
} from './entities.js'
