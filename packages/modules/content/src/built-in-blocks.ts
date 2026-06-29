/**
 * Built-in block definitions for the `blocks()` field type.
 *
 * Import and compose these in your schema config rather than defining block
 * field sets by hand. You can mix built-in blocks with custom ones:
 *
 * ```ts
 * import { blocks, heroBlock, ctaBlock, richTextBlock } from '@latha/content'
 *
 * content: blocks({ blocks: [heroBlock, ctaBlock, richTextBlock] })
 * ```
 */

import { text, richtext } from '@latha/core'
import type { BlockInput } from './builders.js'

export const heroBlock: BlockInput = {
  type: 'hero',
  label: 'Hero',
  fields: {
    heading: text({ required: true, meta: { label: 'Heading' } }),
    subheading: text({ meta: { label: 'Subheading' } }),
    ctaLabel: text({ meta: { label: 'CTA Label' } }),
    ctaHref: text({ meta: { label: 'CTA URL', placeholder: 'https://…' } }),
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
  },
}

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
    src: text({ required: true, meta: { label: 'Image URL', placeholder: 'https://…' } }),
    alt: text({ meta: { label: 'Alt Text' } }),
    caption: text({ meta: { label: 'Caption' } }),
  },
}
