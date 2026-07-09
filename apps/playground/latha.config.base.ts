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

import {
  defineConfig,
  operations,
  z,
  type DBAdapter,
  type FieldsRecord,
  type ResolvedConfig,
  type StorageAdapter,
} from '@latha/core'
import {
  Collection,
  ContentModule,
  Document,
  Taxonomy,
  array,
  blocks,
  heroBlock,
  ctaBlock,
  richTextBlock,
  imageBlock,
  featuresBlock,
  boolean,
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
import { countUsers, createUser } from '@latha/users'
import {
  AuthModule,
  getCatalog,
  getRoleByName,
  hashPassword,
  hasPermission,
  type AuthUser,
} from '@latha/auth'
import { media, MediaModule } from '@latha/media'
import { slug, slugPlugin } from '@latha/slug'

// `text({ schema: ... })` escape hatch — no dedicated `color` field type
// exists (or is needed) for a `#rrggbb` string; `inputType: 'color'` on the
// text renderer already gets a native color picker.
const hexColor = () => z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a 6-digit hex color, e.g. #171717')

// Same escape hatch, for a site-relative route (e.g. `/shop`) that isn't
// backed by a `pages`/`posts` entity — an app route the CMS doesn't know
// about, as opposed to `url` (an external, fully-qualified link).
const internalPath = () => z.string().regex(/^\//, 'Path must start with /, e.g. /shop')

/**
 * The link-target shape shared by every menu link: top-level nav items,
 * their one level of dropdown children, and footer column links. Defined
 * once so the four `linkType` variants (and which field backs each) can't
 * drift between the three places a menu link is declared.
 */
function linkFields(opts: { withNewTab?: boolean } = {}): FieldsRecord {
  const fields: FieldsRecord = {
    label: text({ required: true }),
    linkType: select({
      options: z.enum(['page', 'post', 'url', 'path']),
      defaultValue: 'page',
      meta: { label: 'Link Type' },
    }),
    page: relationship({ to: 'pages', meta: { showIf: { field: 'linkType', equals: 'page' } } }),
    post: relationship({ to: 'posts', meta: { showIf: { field: 'linkType', equals: 'post' } } }),
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
  if (opts.withNewTab) {
    fields.openInNewTab = boolean({ meta: { label: 'Open in New Tab' } })
  }
  return fields
}

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
        // Delivery-API reads land at /api/v1/contents/posts, /api/v1/contents/pages,
        // etc. instead of the module's default name-derived prefix (/api/v1/content/...).
        apiPrefix: 'contents',
        entities: [
          Document({
            slug: 'site-settings',
            // Lives in the settings sidebar (behind the Settings button)
            // rather than the main content nav — same `admin.area` used by
            // `@latha/users`' `users` entity and `@latha/auth`'s RBAC/API-key
            // entities. It's still a `ContentModule` `Document` (a singleton
            // needs `Document()`'s persistence/operations), but display
            // placement is an orthogonal `admin` concern. `group: ''`
            // overrides ContentModule's default "Content" nav label so it
            // sits flat in the settings sidebar (like `users`) instead of
            // nesting under a one-item "Content" folder.
            admin: { area: 'settings', group: '' },
            // Tabs via `meta.group` (same convention as `posts` below):
            // General is the leading, ungrouped tab; Branding/SEO & Meta/
            // Social are opt-in tabs for the rest.
            fields: {
              site_name: text({ required: true, meta: { label: 'Site Name' } }),
              tagline: text(),
              description: text({
                meta: {
                  multiline: true,
                  description: 'Default meta description and social preview text for pages that don’t set their own.',
                },
              }),
              contactEmail: text({ schema: z.email(), meta: { label: 'Contact Email' } }),

              logo: media({
                meta: {
                  group: 'Branding',
                  width: 'half',
                  description: 'Shown in the admin topbar and public site header.',
                },
              }),
              favicon: media({
                meta: {
                  group: 'Branding',
                  width: 'half',
                  description: 'Browser tab icon — square image recommended.',
                },
              }),

              // Public-site theme tokens, named after the shadcn/ui CSS
              // variables this admin's own design system already runs on
              // (@latha/ui/src/styles/globals.css: --background, --foreground,
              // --primary, --secondary, --accent) — a curated subset rather
              // than all ~15 shadcn tokens, since most of those (card, popover,
              // border, ring, ...) are normally derived from these few, not
              // picked individually. `primaryColor` (--primary) is the one
              // color non-technical users actually think about, so it's the
              // only field shown by default — its `meta.shades` preview gives
              // a derived scale for free without asking anyone to pick five
              // colors. The other four stay labeled after their CSS variable,
              // tucked behind `meta.advanced` for whoever wants to override
              // them by hand. Fields only for now — reading these back into
              // the public site's actual CSS variables is a follow-up.
              palette: group({
                fields: {
                  primaryColor: text({
                    schema: hexColor(),
                    defaultValue: '#171717',
                    meta: { label: 'Primary Color', inputType: 'color', shades: true },
                  }),
                  background: text({
                    schema: hexColor(),
                    defaultValue: '#ffffff',
                    meta: { label: 'Background', inputType: 'color', width: 'half', advanced: true },
                  }),
                  foreground: text({
                    schema: hexColor(),
                    defaultValue: '#0a0a0a',
                    meta: { label: 'Foreground', inputType: 'color', width: 'half', advanced: true },
                  }),
                  secondary: text({
                    schema: hexColor(),
                    defaultValue: '#f5f5f5',
                    meta: { label: 'Secondary', inputType: 'color', width: 'half', advanced: true },
                  }),
                  accent: text({
                    schema: hexColor(),
                    defaultValue: '#f5f5f5',
                    meta: { label: 'Accent', inputType: 'color', width: 'half', advanced: true },
                  }),
                },
                meta: {
                  group: 'Branding',
                  label: 'Brand Colors',
                  description: 'Theme colors for the public site.',
                },
              }),

              seo: group({
                fields: {
                  metaTitle: text({ meta: { label: 'Meta Title' } }),
                  metaDescription: text({ meta: { label: 'Meta Description', multiline: true } }),
                  ogImage: media({ meta: { label: 'Default OG Image' } }),
                },
                meta: {
                  group: 'SEO & Meta',
                  label: 'Default SEO',
                  description: 'Fallback search & social metadata for pages that don’t set their own.',
                },
              }),

              social: group({
                fields: {
                  twitter: text({ schema: z.url(), meta: { label: 'X / Twitter', inputType: 'url', placeholder: 'https://x.com/yourhandle' } }),
                  facebook: text({ schema: z.url(), meta: { inputType: 'url', placeholder: 'https://facebook.com/yourpage' } }),
                  instagram: text({ schema: z.url(), meta: { inputType: 'url', placeholder: 'https://instagram.com/yourhandle' } }),
                  linkedin: text({ schema: z.url(), meta: { label: 'LinkedIn', inputType: 'url', placeholder: 'https://linkedin.com/company/yourco' } }),
                },
                meta: { group: 'Social', label: 'Social Links' },
              }),
            },
          }),

          Document({
            slug: 'navigation',
            admin: { group: 'Globals', order: 16 },
            fields: {
              items: array({
                fields: {
                  ...linkFields({ withNewTab: true }),
                  // One level of dropdown nesting — same link shape as the
                  // top-level item, minus a third nesting level (not needed
                  // for a typical site nav).
                  children: array({
                    fields: linkFields({ withNewTab: true }),
                    meta: { label: 'Dropdown Items' },
                    useAsTitle: 'label',
                  }),
                },
                meta: { description: 'Top-level links shown in the site header.' },
                useAsTitle: 'label',
              }),
            },
          }),

          Document({
            slug: 'footer',
            admin: { group: 'Globals', order: 17 },
            // Social links are deliberately NOT duplicated here — the public
            // site reads them from `site-settings.social` (single source of
            // truth). Duplicating the same handles/URLs into a second
            // singleton risks the two drifting when only one gets updated.
            fields: {
              columns: array({
                fields: {
                  title: text({ required: true }),
                  links: array({ fields: linkFields(), useAsTitle: 'label' }),
                },
                meta: { description: 'Footer link columns (e.g. Product, Company, Resources).' },
                useAsTitle: 'title',
              }),
              legalText: richtext({ meta: { label: 'Legal / Copyright Text' } }),
            },
          }),

          Collection({
            slug: 'posts',
            admin: { order: 10, useAsTitle: 'title', defaultColumns: ['title', 'status', 'publishedAt'] },
            // `read`/`create` stay on the RBAC default (deny-by-default + the
            // posts:* permissions). `update`/`delete` get an explicit ownership
            // predicate: the `author` role only ever holds posts:create/read, so
            // without this every author would be locked out of editing their own
            // posts. The guard defers entirely to an explicit predicate once one
            // is declared (see rbac/guard.ts), so it must re-check the blanket
            // posts:update/posts:delete permission itself — otherwise editors and
            // admins would lose the ability to touch posts they didn't author.
            access: {
              update: ({ principal, doc }) => {
                const user = principal as AuthUser | undefined
                if (!user) return false
                return hasPermission(user, 'posts:update') || user.id === doc?.author
              },
              delete: ({ principal, doc }) => {
                const user = principal as AuthUser | undefined
                if (!user) return false
                return hasPermission(user, 'posts:delete') || user.id === doc?.author
              },
            },
            hooks: {
              // Authors (lacking posts:update) can only ever write as themselves;
              // editors/admins may still assign authorship explicitly. Also
              // defaults `author` to the creator when left blank.
              beforeCreate: [
                ({ data, principal }) => {
                  const user = principal as AuthUser | undefined
                  if (!user) return data
                  const canAssignOthers = hasPermission(user, 'posts:update')
                  if (!canAssignOthers || !data.author) {
                    return { ...data, author: user.id }
                  }
                  return data
                },
              ],
            },
            // Main-column fields are split into tabs via `meta.group`: a
            // "Content" tab for the body, an "SEO & Meta" tab for metadata.
            // Sidebar fields (`meta.sidebar`) stay in the sidebar regardless.
            fields: {
              title: text({ required: true, meta: { group: 'Content' } }),
              slug: slug({ from: '{title}', meta: { group: 'Content' } }),
              excerpt: text({ meta: { group: 'Content', multiline: true, description: 'Short summary shown in listings.' } }),
              content: richtext({ meta: { group: 'Content' } }),
              // Zod-first escape hatch: full schema validation server-side,
              // mirrored to the admin form via jsonSchema.
              contactEmail: text({ schema: z.email(), meta: { group: 'SEO & Meta', label: 'Contact Email' } }),
              views: number({ integer: true, defaultValue: 0, meta: { group: 'SEO & Meta' } }),
              seo: group({
                fields: {
                  metaTitle: text({ meta: { label: 'Meta Title' } }),
                  metaDescription: text({ meta: { label: 'Meta Description', multiline: true } }),
                  ogImage: media({ meta: { label: 'OG Image' } }),
                },
                meta: { group: 'SEO & Meta', label: 'SEO', description: 'Search & social metadata.' },
              }),
              // Status leads the sidebar (rendered after the `form.sidebar.before`
              // zone) — the publish control readers reach for first. Sidebar
              // fields render in definition order, so its position here is what
              // places it at the top.
              status: select({
                options: z.enum(['draft', 'published']),
                defaultValue: 'draft',
                meta: { sidebar: true },
              }),
              featuredImage: media({ meta: { label: 'Featured Image', sidebar: true } }),
              category: taxonomy({ to: 'categories', meta: { sidebar: true } }),
              tags: taxonomy({ to: 'tags', many: true, meta: { sidebar: true } }),
              author: relationship({ to: 'users', meta: { sidebar: true } }),
              publishedAt: date({ meta: { sidebar: true, label: 'Published At' } }),
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
              // Nested pages: pick a parent and this page's URL nests under
              // it — the slug stores only the page's own segment, and the
              // plugin maintains the full `path` (cascading to children when
              // a page moves or is renamed).
              parent: relationship({ to: 'pages', meta: { sidebar: true } }),
              slug: slug({ from: '{title}', nested: { parent: 'parent' } }),
              status: select({
                options: z.enum(['draft', 'published']),
                defaultValue: 'draft',
                meta: { sidebar: true },
              }),
              content: blocks({
                blocks: [heroBlock, richTextBlock, ctaBlock, imageBlock, featuresBlock],
              }),
              // Repeatable fieldset — exercises the `array` renderer.
              faqs: array({
                fields: {
                  question: text({ required: true }),
                  answer: text({ meta: { multiline: true } }),
                },
                meta: { description: 'Frequently asked questions shown at the bottom of the page.' },
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

      // Seed the `author` role: admin access plus posts:create/posts:read only —
      // no blanket posts:update/posts:delete, so the posts `access` predicates
      // above fall back to the id === doc.author ownership check for holders of
      // this role. AuthModule's own default-role seeding has already run and
      // synced the catalog by this point (see runtime.ts: bootstrap completes
      // before `seed` runs), so permission keys are already resolvable to ids.
      if (!(await getRoleByName(latha, 'author'))) {
        const catalog = getCatalog(latha)
        const permissionIds = ['admin:access', 'posts:create', 'posts:read']
          .map((key) => catalog?.permissionIdByKey.get(key))
          .filter((id): id is string => typeof id === 'string')
        await latha.db.create('roles', {
          name: 'author',
          label: 'Author',
          description: 'Can write and manage their own posts.',
          permissions: permissionIds,
          system: false,
        })
        console.log('[latha] seeded role: author')
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
