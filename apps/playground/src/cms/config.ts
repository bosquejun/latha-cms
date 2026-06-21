/**
 * Playground CMS config.
 *
 * The playground stays thin: it only composes packages. Phase 2 introduces
 * `@latha/content`, so the entities are now defined with the real
 * `Collection()` / `Document()` / `Taxonomy()` factories and registered via
 * `ContentModule()`.
 */

import { defineConfig } from '@latha/core'
import { tursoAdapter } from '@latha/storage'
import {
  Collection,
  ContentModule,
  Document,
  Taxonomy,
} from '@latha/content'
import { UsersModule } from '@latha/users'
import { AuthModule } from '@latha/auth'

/** Dev fallback — set AUTH_SECRET in production. */
export const AUTH_SECRET = process.env.AUTH_SECRET ?? 'dev-secret-change-me'

export const lathaConfig = defineConfig({
  // Local SQLite file by default; point at Turso via env in production.
  db: tursoAdapter({
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
  modules: [
    UsersModule({ roles: ['admin', 'editor', 'viewer'] }),

    AuthModule({ secret: AUTH_SECRET }),

    ContentModule({
      entities: [
        // Singleton — structural config, no list view.
        Document({
          slug: 'site-settings',
          fields: [
            { name: 'site_name', type: 'text', required: true },
            { name: 'tagline', type: 'text' },
          ],
        }),

        // Many records — standard CRUD.
        Collection({
          slug: 'posts',
          admin: { useAsTitle: 'title', defaultColumns: ['title', 'status'] },
          access: {
            read: () => true,
            create: ({ user }) => !!user,
            update: ({ user }) => !!user,
            delete: ({ user }) => user?.role === 'admin',
          },
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
        }),

        // Hierarchical grouping.
        Taxonomy({
          slug: 'categories',
          hierarchical: true,
        }),
      ],
    }),
  ],
})
