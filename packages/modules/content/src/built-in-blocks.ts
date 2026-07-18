/**
 * Built-in block definitions for the `blocks()` field type.
 *
 * Import and compose these in your schema config rather than defining block
 * field sets by hand. You can mix built-in blocks with custom ones:
 *
 * ```ts
 * import { blocks, heroBlock, ctaBlock, richTextBlock } from '@kon10/content'
 *
 * content: blocks({ blocks: [heroBlock, ctaBlock, richTextBlock] })
 * ```
 */

import { z, text, richtext, select, array, boolean } from '@kon10/core'
import type { AnyFieldDef, FieldMeta } from '@kon10/core'
import type { BlockInput } from './builders.js'

/**
 * A URL text field with an `https://` scheme prefix rendered inside the input
 * border (the Studio `TextField` reads `meta.prefix`). Keeping the scheme as a
 * fixed visual add-on means the editor only types the host + path, so the field
 * reads as one connected control instead of a bare box the user has to remember
 * to prefix — the pattern CLAUDE.md and the `InputGroup` primitive document.
 */
function urlField(
  opts: {
    required?: boolean
    label: string
    placeholder?: string
    description?: string
    width?: FieldMeta['width']
    advanced?: boolean
    showIf?: FieldMeta['showIf']
  } = { label: 'URL' },
): AnyFieldDef {
  const { required, ...meta } = opts
  return text({ required, meta: { prefix: 'https://', ...meta } })
}

/**
 * A reference to a `media` doc, by id. `type: 'media'` is owned by
 * `@kon10/media` — this module must not import it (see the separation-of-
 * concerns table in CLAUDE.md), so the field is written as the raw
 * registered-type literal instead of `@kon10/media`'s `media()` builder. The
 * field type registry resolves `'media'` to the real config/data schema and
 * the Studio picker resolves it to `MediaField` purely by string discriminant
 * at runtime, so this works as long as the app loads `@kon10/media` — the
 * cast is needed because `'media'` isn't a known `FieldType` in this
 * package's own type graph.
 */
function mediaRef(opts: { required?: boolean; meta?: FieldMeta } = {}): AnyFieldDef {
  return { type: 'media', ...opts } as unknown as AnyFieldDef
}

/* -------------------------------------------------------------------------- */
/*  Content                                                                    */
/* -------------------------------------------------------------------------- */

export const richTextBlock: BlockInput = {
  type: 'richtext',
  label: 'Rich Text',
  fields: {
    content: richtext({ required: true, meta: { label: 'Content' } }),
  },
}

export const imageBlock: BlockInput = {
  type: 'image',
  label: 'Image',
  fields: {
    src: mediaRef({ required: true, meta: { label: 'Image', aspectRatio: '16:9' } }),
    alt: text({
      meta: {
        label: 'Alt Text',
        description: 'Describe the image for screen readers and SEO.',
        width: 'half',
      },
    }),
    caption: text({ meta: { label: 'Caption', width: 'half' } }),
  },
}

export const videoBlock: BlockInput = {
  type: 'video',
  label: 'Video',
  fields: {
    url: urlField({
      required: true,
      label: 'Video URL',
      placeholder: 'youtube.com/watch?v=…',
      description: 'Paste a YouTube, Vimeo, or direct video link.',
    }),
    title: text({ meta: { label: 'Title', width: 'half' } }),
    caption: text({ meta: { label: 'Caption', width: 'half' } }),
  },
}

export const embedBlock: BlockInput = {
  type: 'embed',
  label: 'Embed',
  fields: {
    url: urlField({ required: true, label: 'Embed URL', placeholder: 'example.com/embed/…' }),
    title: text({
      meta: { label: 'Title (for accessibility)', width: 'half' },
    }),
    height: text({
      meta: { label: 'Height', suffix: 'px', inputType: 'number', placeholder: '400', width: 'half' },
    }),
  },
}

export const columnsBlock: BlockInput = {
  type: 'columns',
  label: 'Two Columns',
  fields: {
    left: richtext({ required: true, meta: { label: 'Left Column', width: 'half' } }),
    right: richtext({ required: true, meta: { label: 'Right Column', width: 'half' } }),
  },
}

export const spacerBlock: BlockInput = {
  type: 'spacer',
  label: 'Spacer',
  fields: {
    size: select({
      options: z.enum(['sm', 'md', 'lg', 'xl']),
      defaultValue: 'md',
      meta: { label: 'Size' },
    }),
  },
}

/* -------------------------------------------------------------------------- */
/*  Marketing                                                                  */
/* -------------------------------------------------------------------------- */

export const heroBlock: BlockInput = {
  type: 'hero',
  label: 'Hero',
  fields: {
    heading: text({ required: true, meta: { label: 'Heading' } }),
    subheading: text({ meta: { label: 'Subheading', multiline: true } }),
    // Primary call-to-action: label + link sit side by side.
    ctaLabel: text({ meta: { label: 'CTA Label', width: 'half' } }),
    ctaHref: urlField({ label: 'CTA URL', placeholder: 'example.com/pricing', width: 'half' }),
    // The optional secondary link is tucked behind "Advanced options" so the
    // common single-CTA hero stays uncluttered.
    secondaryLabel: text({ meta: { label: 'Secondary Link Label', width: 'half', advanced: true } }),
    secondaryHref: urlField({ label: 'Secondary Link URL', placeholder: 'example.com/docs', width: 'half', advanced: true }),
  },
}

export const ctaBlock: BlockInput = {
  type: 'cta',
  label: 'Call to Action',
  fields: {
    heading: text({ required: true, meta: { label: 'Heading' } }),
    body: text({ meta: { label: 'Body', multiline: true } }),
    buttonLabel: text({ meta: { label: 'Button Label', width: 'half' } }),
    buttonHref: urlField({ label: 'Button URL', placeholder: 'example.com/signup', width: 'half' }),
    variant: select({
      options: z.enum(['default', 'muted', 'dark']),
      defaultValue: 'default',
      meta: { label: 'Style' },
    }),
  },
}

export const bannerBlock: BlockInput = {
  type: 'banner',
  label: 'Banner',
  fields: {
    message: text({ required: true, meta: { label: 'Message', multiline: true } }),
    variant: select({
      options: z.enum(['info', 'success', 'warning', 'promo']),
      defaultValue: 'info',
      meta: { label: 'Style' },
    }),
    // Link fields stay hidden until the editor opts into a call-to-action, so an
    // informational banner isn't cluttered with empty link inputs.
    hasLink: boolean({ meta: { label: 'Include a link' } }),
    linkLabel: text({ meta: { label: 'Link Label', width: 'half', showIf: { field: 'hasLink', equals: true } } }),
    linkHref: urlField({ label: 'Link URL', placeholder: 'example.com', width: 'half', showIf: { field: 'hasLink', equals: true } }),
    dismissible: boolean({ meta: { label: 'Allow dismissing', advanced: true } }),
  },
}

export const featuresBlock: BlockInput = {
  type: 'features',
  label: 'Features',
  fields: {
    heading: text({ meta: { label: 'Heading', width: 'half' } }),
    subheading: text({ meta: { label: 'Subheading', width: 'half' } }),
    layout: select({
      options: z.enum(['grid', 'list']),
      defaultValue: 'grid',
      meta: { label: 'Layout' },
    }),
    // Column count only applies to the grid layout.
    columns: select({
      options: z.enum(['2', '3', '4']),
      defaultValue: '3',
      meta: { label: 'Columns', showIf: { field: 'layout', equals: 'grid' } },
    }),
    items: array({
      fields: {
        icon: text({ meta: { label: 'Icon (name or URL)', width: 'half' } }),
        title: text({ required: true, meta: { label: 'Title', width: 'half' } }),
        description: text({ meta: { label: 'Description', multiline: true } }),
      },
      meta: { label: 'Feature Items' },
    }),
  },
}

export const statsBlock: BlockInput = {
  type: 'stats',
  label: 'Stats',
  fields: {
    heading: text({ meta: { label: 'Heading' } }),
    items: array({
      fields: {
        value: text({ required: true, meta: { label: 'Value', placeholder: '10k+', width: 'half' } }),
        label: text({ required: true, meta: { label: 'Label', placeholder: 'Users', width: 'half' } }),
        description: text({ meta: { label: 'Description' } }),
      },
      meta: { label: 'Stats' },
    }),
  },
}

export const testimonialBlock: BlockInput = {
  type: 'testimonial',
  label: 'Testimonial',
  fields: {
    quote: richtext({ required: true, meta: { label: 'Quote' } }),
    authorName: text({ required: true, meta: { label: 'Author Name', width: 'half' } }),
    authorRole: text({ meta: { label: 'Author Role / Title', width: 'half' } }),
    // Company and avatar are secondary attribution details.
    authorCompany: text({ meta: { label: 'Company', width: 'half', advanced: true } }),
    avatarUrl: urlField({ label: 'Avatar URL', placeholder: 'example.com/avatar.jpg', width: 'half', advanced: true }),
  },
}

export const faqBlock: BlockInput = {
  type: 'faq',
  label: 'FAQ',
  fields: {
    heading: text({ meta: { label: 'Heading' } }),
    items: array({
      fields: {
        question: text({ required: true, meta: { label: 'Question' } }),
        answer: richtext({ required: true, meta: { label: 'Answer' } }),
      },
      meta: { label: 'Questions' },
    }),
  },
}

export const galleryBlock: BlockInput = {
  type: 'gallery',
  label: 'Gallery',
  fields: {
    heading: text({ meta: { label: 'Heading' } }),
    layout: select({
      options: z.enum(['grid', 'masonry', 'carousel']),
      defaultValue: 'grid',
      meta: { label: 'Layout' },
    }),
    // Columns apply to the tiled layouts; autoplay only makes sense for a carousel.
    columns: select({
      options: z.enum(['2', '3', '4']),
      defaultValue: '3',
      meta: { label: 'Columns', showIf: { field: 'layout', in: ['grid', 'masonry'] } },
    }),
    autoplay: boolean({ meta: { label: 'Auto-advance slides', showIf: { field: 'layout', equals: 'carousel' } } }),
    items: array({
      fields: {
        src: mediaRef({ required: true, meta: { label: 'Image', aspectRatio: '1:1' } }),
        alt: text({ meta: { label: 'Alt Text', width: 'half' } }),
        caption: text({ meta: { label: 'Caption', width: 'half' } }),
      },
      meta: { label: 'Images' },
    }),
  },
}
