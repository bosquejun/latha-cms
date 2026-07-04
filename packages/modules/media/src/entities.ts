import { relationship, stampFields, text, number, type Entity, type FieldsRecord } from '@latha/core'

export const MEDIA_SLUG = 'media'

/**
 * Built directly (not via `@latha/content`'s `Collection()`) — media must not
 * depend on the content module (lateral module-to-module import), same as
 * `@latha/users` builds its raw `Entity` by hand.
 */
export function buildMediaEntity(): Entity {
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
    admin: {
      segment: 'content',
      useAsTitle: 'filename',
      defaultColumns: ['filename', 'mimeType', 'size'],
      labels: { singular: 'Media', plural: 'Media Library' },
    },
    fields: stampFields(fields),
  }
}
