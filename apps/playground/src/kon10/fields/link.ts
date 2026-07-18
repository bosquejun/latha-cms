import { z, type FieldsRecord } from '@kon10/core'
import { boolean, relationship, select, text } from '@kon10/content'
import { internalPath } from './validators.js'

/**
 * Shared link-target fields for navigation items and footer links.
 */
export function linkFields({
  withNewTab = false,
}: {
  withNewTab?: boolean
} = {}): FieldsRecord {
  const fields: FieldsRecord = {
    label: text({ required: true }),
    linkType: select({
      options: z.enum(['page', 'post', 'url', 'path']),
      defaultValue: 'page',
      meta: { label: 'Link Type' },
    }),
    page: relationship({
      to: 'pages',
      meta: { showIf: { field: 'linkType', equals: 'page' } },
    }),
    post: relationship({
      to: 'posts',
      meta: { showIf: { field: 'linkType', equals: 'post' } },
    }),
    url: text({
      schema: z.url(),
      meta: {
        label: 'External URL',
        placeholder: 'https://…',
        showIf: { field: 'linkType', equals: 'url' },
      },
    }),
    path: text({
      schema: internalPath(),
      meta: {
        label: 'Internal Path',
        placeholder: '/shop',
        description: 'A site route not backed by a CMS page.',
        showIf: { field: 'linkType', equals: 'path' },
      },
    }),
  }

  if (withNewTab) {
    fields.openInNewTab = boolean({
      meta: { label: 'Open in New Tab' },
    })
  }

  return fields
}
