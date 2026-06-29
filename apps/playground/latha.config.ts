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
import { hashPassword, getRoleByName } from '@latha/auth'

export default defineConfig({
  db: tursoAdapter({
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),

  modules: [
    UsersModule(),

    // AuthModule owns RBAC: it seeds the admin/editor/viewer roles on first run
    // and syncs the scope/permission catalog from the entities below.
    AuthModule({ secret: process.env.AUTH_SECRET ?? 'latha-dev-secret-change-me' }),

    ContentModule({
      entities: [
        Document({
          slug: 'site-settings',
          // `admin.order` positions an entity within its menu group (lower =
          // higher). Site settings sits last, after Posts and Categories.
          admin: { order: 30 },
          fields: {
            site_name: text({ required: true }),
            tagline: text(),
          },
        }),

        Collection({
          slug: 'posts',
          admin: { order: 10, useAsTitle: 'title', defaultColumns: ['title', 'status'] },
          // No explicit `access` block: the admin surface is governed by RBAC
          // (deny-by-default + the posts:* permissions). To expose public,
          // headless reads, add e.g. `access: { read: () => true }` — explicit
          // predicates always override the RBAC default for that operation.
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
              meta: { sidebar: true },
            }),
            views: number({ integer: true, defaultValue: 0 }),
          },
        }),

        Taxonomy({ slug: 'categories', hierarchical: true, admin: { order: 20 } }),
      ],
    }),
  ],

  // First-run seed so login works out of the box. AuthModule has already seeded
  // the default roles by this point, so we can assign the admin role by id.
  seed: async (latha) => {
    if ((await countUsers(latha)) === 0) {
      const adminRole = await getRoleByName(latha, 'admin')
      await createUser(latha, {
        email: process.env.ADMIN_EMAIL ?? 'admin@latha.dev',
        name: 'Admin',
        roles: adminRole ? [adminRole.id] : [],
        passwordHash: await hashPassword(process.env.ADMIN_PASSWORD ?? 'password'),
      })
      console.log('[latha] seeded admin: admin@latha.dev / password')
    }
  },
})
