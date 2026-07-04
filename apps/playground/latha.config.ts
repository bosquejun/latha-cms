/**
 * latha.config.ts — the single entrypoint.
 *
 * Everything the CMS does (schema, API, admin UI, auth) derives from this file.
 * The app's only other code is a one-line server endpoint and a couple of mount
 * points; see `src/`.
 */

import { defineConfig } from '@latha/core'
import { postgresAdapter } from '@latha/storage'
import {
  Collection,
  ContentModule,
  Document,
  Taxonomy,
  blocks,
  heroBlock,
  ctaBlock,
  richTextBlock,
  imageBlock,
  featuresBlock,
  number,
  richtext,
  select,
  text,
} from '@latha/content'
import { UsersModule } from '@latha/users'
import { AuthModule } from '@latha/auth'
import { countUsers, createUser } from '@latha/users'
import { hashPassword, getRoleByName } from '@latha/auth'
import { localDiskStorage, media, MediaModule } from '@latha/media'

export default defineConfig({
  // Postgres over @libsql/client (Turso): the `postgres` driver is pure
  // JS/TCP with zero native dependencies, so it doesn't hit the
  // native-binding-in-a-serverless-bundle problem @libsql/client has on
  // Vercel. Works against a self-hosted Postgres or Supabase — for Supabase
  // on Vercel, use the *pooled* connection string (`prepare: false` below is
  // required for pgBouncer's transaction mode).
  db: postgresAdapter({
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/latha',
    prepare: false,
  }),

  modules: [
    UsersModule(),

    // AuthModule owns RBAC: it seeds the admin/editor/viewer roles on first run
    // and syncs the scope/permission catalog from the entities below.
    AuthModule({ secret: process.env.AUTH_SECRET ?? 'latha-dev-secret-change-me' }),

    // Dev-only local-disk adapter — writes into public/uploads so Vite serves
    // the files back with no extra routing. Production deploys should
    // configure an R2/S3-compatible adapter instead (not built yet).
    MediaModule({
      storage: localDiskStorage({ dir: './public/uploads', publicPath: '/uploads' }),
    }),

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
            featuredImage: media({ meta: { label: 'Featured Image', sidebar: true } }),
            status: select({
              options: ['draft', 'published'],
              defaultValue: 'draft',
              meta: { sidebar: true },
            }),
            views: number({ integer: true, defaultValue: 0 }),
          },
        }),

        Taxonomy({ slug: 'categories', hierarchical: true, admin: { order: 20 } }),

        Collection({
          slug: 'pages',
          admin: { order: 15, useAsTitle: 'title', defaultColumns: ['title', 'status'] },
          fields: {
            title: text({ required: true }),
            slug: text({ unique: true }),
            status: select({
              options: ['draft', 'published'],
              defaultValue: 'draft',
              meta: { sidebar: true },
            }),
            content: blocks({
              blocks: [heroBlock, richTextBlock, ctaBlock, imageBlock, featuresBlock],
            }),
          },
        }),
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
