/**
 * latha.config.base.ts — everything except the DB and storage adapters.
 *
 * Split out so the two environment-specific entrypoints (`latha.config.ts`
 * for local dev, `latha.config.vercel.ts` for Vercel) can each pass their own
 * `DBAdapter`/`StorageAdapter` without duplicating the rest of the app's
 * schema/modules/seed. `vite.config.ts` picks which entrypoint to build
 * against, so only one pair's module graph (and its dependencies) is ever
 * reachable in a given build — not a runtime branch inside one bundle.
 */

import { defineConfig, z, type DBAdapter, type ResolvedConfig, type StorageAdapter } from '@latha/core'
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
import { media, MediaModule } from '@latha/media'
import { slug, slugPlugin } from '@latha/slug'

export function buildConfig(db: DBAdapter, storage: StorageAdapter): ResolvedConfig {
  return defineConfig({
    db,

    // slugPlugin wires generation + uniqueness hooks into every entity below
    // that carries a slug() field (posts, pages).
    plugins: [slugPlugin()],

    modules: [
      UsersModule(),

      // AuthModule owns RBAC: it seeds the admin/editor/viewer roles on first run
      // and syncs the scope/permission catalog from the entities below.
      AuthModule({ secret: process.env.AUTH_SECRET ?? 'latha-dev-secret-change-me' }),

      MediaModule({ storage }),

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
            fields: {
              title: text({ required: true }),
              slug: slug({ from: '{title}' }),
              // Zod-first escape hatch: full schema validation server-side,
              // mirrored to the admin form via jsonSchema.
              contactEmail: text({ schema: z.email(), meta: { label: 'Contact Email' } }),
              content: richtext(),
              featuredImage: media({ meta: { label: 'Featured Image', sidebar: true } }),
              status: select({
                options: z.enum(['draft', 'published']),
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
              slug: slug({ from: '{title}' }),
              status: select({
                options: z.enum(['draft', 'published']),
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
}
