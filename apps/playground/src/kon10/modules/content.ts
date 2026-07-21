import { z } from '@kon10/core'
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
  videoBlock,
  columnsBlock,
  bannerBlock,
  featuresBlock,
  statsBlock,
  testimonialBlock,
  faqBlock,
  galleryBlock,
  date,
  group,
  number,
  relationship,
  richtext,
  select,
  taxonomy,
  text,
} from '@kon10/content'
import { hasPermission, type AuthUser } from '@kon10/auth'
import { media } from '@kon10/media'
import { slug } from '@kon10/slug'
import { seo, socialGraph } from '@kon10/seo'
import { linkFields } from '../fields/link.js'
import { hexColor } from '../fields/validators.js'

export function createContentModule() {
  return ContentModule({
        // Delivery-API reads land at /api/v1/contents/posts, /api/v1/contents/pages,
        // etc. instead of the module's default name-derived prefix (/api/v1/content/...).
        apiPrefix: 'contents',
        entities: [
          Document({
            slug: 'site-settings',
            // Lives in the settings sidebar (behind the Settings button)
            // rather than the main content nav — same `studio.area` used by
            // `@kon10/users`' `users` entity and `@kon10/auth`'s RBAC/API-key
            // entities. It's still a `ContentModule` `Document` (a singleton
            // needs `Document()`'s persistence/operations), but display
            // placement is an orthogonal `studio` concern. `group: ''`
            // overrides ContentModule's default "Content" nav label so it
            // sits flat in the settings sidebar (like `users`) instead of
            // nesting under a one-item "Content" folder.
            studio: { area: 'settings', group: '' },
            // Written rarely (only from the Studio), read on nearly every public
            // page load — a long TTL on the delivery-API cache trades a bit of
            // staleness after an edit for far fewer reads hitting the db.
            cache: { ttlSeconds: 3600 },
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
                  aspectRatio: '3:1',
                  description: 'Shown in the Studio topbar and public site header.',
                },
              }),
              favicon: media({
                meta: {
                  group: 'Branding',
                  width: 'half',
                  aspectRatio: '1:1',
                  description: 'Browser tab icon — square image recommended.',
                },
              }),

              // Public-site theme tokens, named after the shadcn/ui CSS
              // variables this Studio's own design system already runs on
              // (@kon10/ui/src/styles/globals.css: --background, --foreground,
              // --primary, --secondary, --accent) — a curated subset rather
              // than all ~15 shadcn tokens, since most of those (card, popover,
              // border, ring, ...) are normally derived from these few, not
              // picked individually. `primaryColor` (--primary) is the one
              // color non-technical users actually think about, so it's the
              // only field shown by default — its `meta.shades` preview gives
              // a derived scale for free without asking anyone to pick five
              // colors. The other four stay labeled after their CSS variable,
              // tucked behind `meta.advanced` for whoever wants to override
              // them by hand.
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
                  ogImage: media({ meta: { label: 'Default OG Image', aspectRatio: '1.91:1' } }),
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
            slug: 'landing-page',
            studio: { group: 'Globals', order: 15, contentWidth: 'full' },
            fields: {
              // A flexible, ordered page builder — same `blocks()` field type
              // `pages.content` uses below, so editors compose the landing
              // page from the same block library (start with a Hero block,
              // add Features/Stats/Testimonials/CTA/FAQ/etc. beneath it)
              // instead of a bespoke fixed layout that would drift from it.
              sections: blocks({
                blocks: [
                  heroBlock,
                  featuresBlock,
                  statsBlock,
                  testimonialBlock,
                  ctaBlock,
                  faqBlock,
                  galleryBlock,
                  bannerBlock,
                  richTextBlock,
                  imageBlock,
                  videoBlock,
                  columnsBlock,
                ],
                meta: { description: 'Landing page sections, in display order. Start with a Hero block.' },
              }),
              // Full search & social metadata (title, description, canonical,
              // OpenGraph, Twitter, robots) with live previews — the plugin
              // owns the field type, so this one call replaces the hand-rolled
              // group. The landing page has no title/excerpt to derive from, so
              // editors fill it directly.
              // Search metadata and social cards split into their own tabs —
              // both owned by seoPlugin, each with its own live preview.
              seo: seo({ meta: { group: 'SEO', description: 'Search engine metadata for the landing page.' } }),
              social: socialGraph({ meta: { group: 'Social Graph', description: 'Open Graph & Twitter cards.' } }),
            },
          }),

          Document({
            slug: 'navigation',
            studio: { group: 'Globals', order: 16 },
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
            studio: { group: 'Globals', order: 17 },
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
            studio: { order: 10, useAsTitle: 'title', defaultColumns: ['title', 'status', 'publishedAt'] },
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
            // "Content" tab for the body, then the plugin-owned "SEO" and
            // "Social Graph" tabs. Sidebar fields (`meta.sidebar`) stay in the
            // sidebar regardless.
            fields: {
              title: text({ required: true, meta: { group: 'Content' } }),
              slug: slug({ from: '{title}', meta: { group: 'Content' } }),
              excerpt: text({ meta: { group: 'Content', multiline: true, description: 'Short summary shown in listings.' } }),
              content: richtext({ meta: { group: 'Content' } }),
              // Zod-first escape hatch: full schema validation server-side,
              // mirrored to the Studio form via jsonSchema. Grouped into the SEO
              // tab alongside the seo() field.
              contactEmail: text({ schema: z.email(), meta: { group: 'SEO', label: 'Contact Email' } }),
              views: number({ integer: true, defaultValue: 0, meta: { group: 'SEO' } }),
              // The plugin derives `title` from `title` and `description` from
              // `excerpt` on create (see seoPlugin's inferred `from`), so a new
              // post ships with sensible metadata before the editor touches it.
              seo: seo({ meta: { group: 'SEO' } }),
              social: socialGraph({ meta: { group: 'Social Graph' } }),
              // Status leads the sidebar (rendered after the `form.sidebar.before`
              // zone) — the publish control readers reach for first. Sidebar
              // fields render in definition order, so its position here is what
              // places it at the top.
              status: select({
                options: z.enum(['draft', 'published']),
                defaultValue: 'draft',
                meta: { sidebar: true },
              }),
              featuredImage: media({
                meta: { label: 'Featured Image', sidebar: true, aspectRatio: '16:9' },
              }),
              category: taxonomy({ to: 'categories', meta: { sidebar: true } }),
              tags: taxonomy({ to: 'tags', many: true, meta: { sidebar: true } }),
              author: relationship({ to: 'users', meta: { sidebar: true } }),
              publishedAt: date({
                min: '2000-01-01T00:00:00.000Z',
                max: '2100-12-31T23:59:59.999Z',
                meta: { sidebar: true, label: 'Published At' },
              }),
            },
          }),

          Taxonomy({ slug: 'categories', hierarchical: true, studio: { order: 20 } }),

          // Flat taxonomy (no parent) — the posts `tags` field references it.
          Taxonomy({ slug: 'tags', studio: { order: 25 } }),

          Collection({
            slug: 'pages',
            // `content` is a block-based page builder (same `blocks()` field and
            // block library as `landing-page` above), so the editor gets the
            // same `contentWidth: 'full'` treatment: blocks like Hero, Image,
            // and Features preview at real page width instead of being squeezed
            // into the centered reading-width column. (Long-form rich text —
            // e.g. `posts.content` — deliberately stays on the default centered
            // width, which is the better measure for reading prose.)
            studio: { order: 15, useAsTitle: 'title', defaultColumns: ['title', 'status'], contentWidth: 'full' },
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
  })
}
