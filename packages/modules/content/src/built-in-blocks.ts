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

import { z, text, richtext, select, array } from '@kon10/core'
import type { AnyFieldDef, FieldMeta } from '@kon10/core'
import type { BlockInput } from './builders.js'

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
    src: mediaRef({ required: true, meta: { label: 'Image' } }),
    alt: text({ meta: { label: 'Alt Text' } }),
    caption: text({ meta: { label: 'Caption' } }),
  },
}

export const videoBlock: BlockInput = {
  type: 'video',
  label: 'Video',
  fields: {
    url: text({ required: true, meta: { label: 'Video URL', placeholder: 'https://youtube.com/…' } }),
    title: text({ meta: { label: 'Title' } }),
    caption: text({ meta: { label: 'Caption' } }),
  },
}

export const embedBlock: BlockInput = {
  type: 'embed',
  label: 'Embed',
  fields: {
    url: text({ required: true, meta: { label: 'Embed URL', placeholder: 'https://…' } }),
    title: text({ meta: { label: 'Title (for accessibility)' } }),
    height: text({ meta: { label: 'Height (px)', placeholder: '400' } }),
  },
}

export const columnsBlock: BlockInput = {
  type: 'columns',
  label: 'Two Columns',
  fields: {
    left: richtext({ required: true, meta: { label: 'Left Column' } }),
    right: richtext({ required: true, meta: { label: 'Right Column' } }),
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
    subheading: text({ meta: { label: 'Subheading' } }),
    ctaLabel: text({ meta: { label: 'CTA Label' } }),
    ctaHref: text({ meta: { label: 'CTA URL', placeholder: 'https://…' } }),
    secondaryLabel: text({ meta: { label: 'Secondary Link Label' } }),
    secondaryHref: text({ meta: { label: 'Secondary Link URL', placeholder: 'https://…' } }),
  },
}

export const ctaBlock: BlockInput = {
  type: 'cta',
  label: 'Call to Action',
  fields: {
    heading: text({ required: true, meta: { label: 'Heading' } }),
    body: text({ meta: { label: 'Body' } }),
    buttonLabel: text({ meta: { label: 'Button Label' } }),
    buttonHref: text({ meta: { label: 'Button URL', placeholder: 'https://…' } }),
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
    message: text({ required: true, meta: { label: 'Message' } }),
    linkLabel: text({ meta: { label: 'Link Label' } }),
    linkHref: text({ meta: { label: 'Link URL', placeholder: 'https://…' } }),
    variant: select({
      options: z.enum(['info', 'success', 'warning', 'promo']),
      defaultValue: 'info',
      meta: { label: 'Style' },
    }),
  },
}

export const featuresBlock: BlockInput = {
  type: 'features',
  label: 'Features',
  fields: {
    heading: text({ meta: { label: 'Heading' } }),
    subheading: text({ meta: { label: 'Subheading' } }),
    layout: select({
      options: z.enum(['grid', 'list']),
      defaultValue: 'grid',
      meta: { label: 'Layout' },
    }),
    items: array({
      fields: {
        icon: text({ meta: { label: 'Icon (name or URL)' } }),
        title: text({ required: true, meta: { label: 'Title' } }),
        description: text({ meta: { label: 'Description' } }),
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
        value: text({ required: true, meta: { label: 'Value', placeholder: '10k+' } }),
        label: text({ required: true, meta: { label: 'Label', placeholder: 'Users' } }),
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
    authorName: text({ required: true, meta: { label: 'Author Name' } }),
    authorRole: text({ meta: { label: 'Author Role / Title' } }),
    authorCompany: text({ meta: { label: 'Company' } }),
    avatarUrl: text({ meta: { label: 'Avatar URL', placeholder: 'https://…' } }),
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
    items: array({
      fields: {
        src: mediaRef({ required: true, meta: { label: 'Image' } }),
        alt: text({ meta: { label: 'Alt Text' } }),
        caption: text({ meta: { label: 'Caption' } }),
      },
      meta: { label: 'Images' },
    }),
  },
}
