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

import { defineConfig, operations, z, type DBAdapter, type ResolvedConfig, type StorageAdapter } from '@latha/core'
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
  date,
  group,
  number,
  relationship,
  richtext,
  select,
  taxonomy,
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
            admin: { order: 10, useAsTitle: 'title', defaultColumns: ['title', 'status', 'publishedAt'] },
            // No explicit `access` block: the admin surface is governed by RBAC
            // (deny-by-default + the posts:* permissions). To expose public,
            // headless reads, add e.g. `access: { read: () => true }` — explicit
            // predicates always override the RBAC default for that operation.
            fields: {
              title: text({ required: true }),
              slug: slug({ from: '{title}' }),
              excerpt: text({ meta: { multiline: true, description: 'Short summary shown in listings.' } }),
              // Zod-first escape hatch: full schema validation server-side,
              // mirrored to the admin form via jsonSchema.
              contactEmail: text({ schema: z.email(), meta: { label: 'Contact Email' } }),
              content: richtext(),
              featuredImage: media({ meta: { label: 'Featured Image', sidebar: true } }),
              category: taxonomy({ to: 'categories', meta: { sidebar: true } }),
              tags: taxonomy({ to: 'tags', many: true, meta: { sidebar: true } }),
              author: relationship({ to: 'users', meta: { sidebar: true } }),
              publishedAt: date({ meta: { sidebar: true, label: 'Published At' } }),
              status: select({
                options: z.enum(['draft', 'published']),
                defaultValue: 'draft',
                meta: { sidebar: true },
              }),
              views: number({ integer: true, defaultValue: 0 }),
              seo: group({
                fields: {
                  metaTitle: text({ meta: { label: 'Meta Title' } }),
                  metaDescription: text({ meta: { label: 'Meta Description', multiline: true } }),
                  ogImage: media({ meta: { label: 'OG Image' } }),
                },
                meta: { label: 'SEO', description: 'Search & social metadata.' },
              }),
            },
          }),

          Taxonomy({ slug: 'categories', hierarchical: true, admin: { order: 20 } }),

          // Flat taxonomy (no parent) — the posts `tags` field references it.
          Taxonomy({ slug: 'tags', admin: { order: 25 } }),

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

      // Seed a few taxonomy terms so the category/tags pickers have options.
      // A system principal bypasses RBAC guards, matching how users are seeded.
      const sys = { cms: latha, principal: { id: '__system__', permissions: ['*'] } }

      if ((await latha.db.count('categories')) === 0) {
        const eng = await operations.create(sys, 'categories', {
          name: 'Engineering',
          slug: 'engineering',
        })
        await operations.create(sys, 'categories', {
          name: 'Frameworks',
          slug: 'frameworks',
          parent: eng.id,
        })
        await operations.create(sys, 'categories', { name: 'Design', slug: 'design' })
        console.log('[latha] seeded categories')
      }

      if ((await latha.db.count('tags')) === 0) {
        for (const name of ['nextjs', 'cms', 'release']) {
          await operations.create(sys, 'tags', { name, slug: name })
        }
        console.log('[latha] seeded tags')
      }
    },
  })
}
