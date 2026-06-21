/**
 * Playground CMS config.
 *
 * The playground stays thin: it only composes packages. For Phase 1 this is a
 * single hardcoded `posts` Collection registered through a minimal inline
 * module. Once `@latha/content` lands (Phase 2), this becomes a
 * `ContentModule({ entities: [...] })`.
 */

import { defineConfig, type CMSModule } from '@latha/core'
import { tursoAdapter } from '@latha/storage'

/** A minimal inline ContentModule stand-in for Phase 1. */
const ContentModule: CMSModule = {
  name: 'content',
  entities: [
    {
      kind: 'collection',
      slug: 'posts',
      admin: { useAsTitle: 'title', defaultColumns: ['title', 'status'] },
      hooks: {
        beforeCreate: [
          ({ data }) => {
            const title = String(data.title ?? '')
            const slug =
              (data.slug as string | undefined) ??
              title
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
            return { ...data, slug }
          },
        ],
      },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'slug', type: 'text', unique: true },
        { name: 'content', type: 'richtext' },
        {
          name: 'status',
          type: 'select',
          options: ['draft', 'published'],
          defaultValue: 'draft',
          admin: { sidebar: true },
        },
        { name: 'views', type: 'number', integer: true, defaultValue: 0 },
      ],
    },
  ],
}

export const cmsConfig = defineConfig({
  // Local SQLite file by default; point at Turso via env in production.
  db: tursoAdapter({
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  modules: [ContentModule],
})
