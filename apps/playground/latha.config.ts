/**
 * latha.config.ts — the single entrypoint.
 *
 * Everything the CMS does (schema, API, admin UI, auth) derives from this file.
 * The app's only other code is a one-line server endpoint and a couple of mount
 * points; see `src/`.
 */

import { defineConfig } from '@latha/core'
import { tursoAdapter } from '@latha/storage'
import {
  Collection,
  ContentModule,
  Document,
  Taxonomy,
  number,
  richtext,
  select,
  text,
} from '@latha/content'
import { UsersModule } from '@latha/users'
import { AuthModule } from '@latha/auth'
import { countUsers, createUser } from '@latha/users'
import { hashPassword } from '@latha/auth'

export default defineConfig({
  db: tursoAdapter({
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),

  modules: [
    UsersModule({ roles: ['admin', 'editor', 'viewer'] }),

    AuthModule({ secret: process.env.AUTH_SECRET ?? 'latha-dev-secret-change-me' }),

    ContentModule({
      entities: [
        Document({
          slug: 'site-settings',
          fields: {
            site_name: text({ required: true }),
            tagline: text(),
          },
        }),

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
          fields: {
            title: text({ required: true }),
            slug: text({ unique: true }),
            content: richtext(),
            status: select({
              options: ['draft', 'published'],
              defaultValue: 'draft',
              admin: { sidebar: true },
            }),
            views: number({ integer: true, defaultValue: 0 }),
          },
        }),

        Taxonomy({ slug: 'categories', hierarchical: true }),
      ],
    }),
  ],

  // First-run seed so login works out of the box.
  seed: async (latha) => {
    if ((await countUsers(latha)) === 0) {
      await createUser(latha, {
        email: process.env.ADMIN_EMAIL ?? 'admin@latha.dev',
        name: 'Admin',
        role: 'admin',
        passwordHash: await hashPassword(process.env.ADMIN_PASSWORD ?? 'password'),
      })
      console.log('[latha] seeded admin: admin@latha.dev / password')
    }
  },
})
