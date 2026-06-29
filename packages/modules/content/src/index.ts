/**
 * @latha/content — ContentModule and the Collection / Document / Taxonomy
 * entity factories, plus the config-driven content API.
 */

import type { BaseFieldConfig } from '@latha/core'
import type { BlockDefinition } from './builders.js'

// Augment core's FieldTypeMap so consumers get the content-module field types.
declare module '@latha/core' {
  interface FieldTypeMap {
    taxonomy: BaseFieldConfig & { type: 'taxonomy'; to: string; many?: boolean }
    blocks: BaseFieldConfig & { type: 'blocks'; blocks: BlockDefinition[] }
  }
}

export { Collection, Document, Taxonomy } from './entities.js'
export type {
  CollectionConfig,
  DocumentConfig,
  TaxonomyInput,
} from './entities.js'

// Field builders + inference, re-exported so configs can import everything
// they need from `@latha/content`.
export {
  text,
  number,
  boolean,
  date,
  select,
  richtext,
  relationship,
  group,
  array,
  type AnyFieldDef,
  type FieldsRecord,
  type InferDoc,
} from '@latha/core'

// Content-module field builders — these field types are owned by this module.
export { taxonomy, blocks, type BlockInput, type BlockDefinition } from './builders.js'

// Built-in block definitions for common page sections.
export {
  // Content
  richTextBlock,
  imageBlock,
  videoBlock,
  embedBlock,
  columnsBlock,
  spacerBlock,
  // Marketing
  heroBlock,
  ctaBlock,
  bannerBlock,
  featuresBlock,
  statsBlock,
  testimonialBlock,
  faqBlock,
  galleryBlock,
} from './built-in-blocks.js'

export { ContentModule } from './module.js'
export type { ContentModuleConfig } from './module.js'

export { createContentApi } from './api.js'
export type {
  ContentApi,
  ContentApiOptions,
  JsonDoc,
  JsonTermNode,
} from './api.js'
