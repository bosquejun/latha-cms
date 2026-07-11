import { relationship, stampFields, text, number, type Entity, type FieldsRecord } from '@kon10/core'

export const MEDIA_SLUG = 'media'

/**
 * Server-side upload policy, enforced by the upload dispatcher before any
 * bytes reach the storage adapter. Attached to the media entity as an opaque
 * passthrough (same contract as `kind`/`studio`) so the framework layer can
 * read it without depending on this package.
 */
export interface UploadPolicy {
  /** Maximum upload size in bytes. */
  maxFileSize: number
  /** Allowed MIME types — exact (`application/pdf`) or wildcard (`image/*`). */
  allowedMimeTypes: string[]
}

export const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MiB

export const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
]

export type MediaEntity = Entity & { upload: UploadPolicy }

/**
 * Built directly (not via `@kon10/content`'s `Collection()`) — media must not
 * depend on the content module (lateral module-to-module import), same as
 * `@kon10/users` builds its raw `Entity` by hand.
 */
export function buildMediaEntity(policy?: Partial<UploadPolicy>): MediaEntity {
  const fields: FieldsRecord = {
    filename: text({ required: true }),
    mimeType: text({ required: true }),
    size: number({ integer: true, required: true }),
    url: text({ required: true }),
    key: text({ required: true, meta: { hidden: true, description: 'Internal storage key.' } }),
    alt: text({ meta: { label: 'Alt text', description: 'Describes the image for accessibility and SEO.' } }),
    uploadedBy: relationship({ to: 'users', meta: { sidebar: true, hidden: true } }),
  }

  return {
    kind: 'collection',
    cardinality: 'many',
    slug: MEDIA_SLUG,
    timestamps: true,
    actions: ['read', 'create', 'update', 'delete'],
    studio: {
      segment: 'content',
      useAsTitle: 'filename',
      defaultColumns: ['filename', 'mimeType', 'size'],
      labels: { singular: 'Media', plural: 'Media Library' },
      // `media` is the only entity `MediaModule` registers, so the default
      // module-label group would render a one-item "Media" folder — override
      // to sit flat instead, same reasoning as `site-settings`' `group: ''`.
      group: '',
      // Ungrouped items sort by this order among themselves and against
      // labelled groups alike — push Media Library after content groups
      // (e.g. Globals) rather than defaulting to the front of the nav.
      order: 50,
    },
    fields: stampFields(fields),
    upload: {
      maxFileSize: policy?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
      allowedMimeTypes: policy?.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES,
    },
  }
}
