/**
 * @kon10/content — ContentModule and the Collection / Document / Taxonomy
 * entity factories, plus the config-driven content API.
 */

import type { z } from 'zod'
import type { BaseFieldConfig } from 'kon10'
import type { BlockDefinition } from './builders.js'
import type { blocksFieldConfigSchema, taxonomyFieldConfigSchema } from './module.js'

// Augment core's FieldTypeMap so consumers get the content-module field
// types. Each entry derives from the Zod schema registered in `module.ts` via
// `z.infer`, so the schema stays the single source of truth for both runtime
// validation and this compile-time type.
declare module 'kon10' {
  interface FieldTypeMap {
    taxonomy: BaseFieldConfig & z.infer<typeof taxonomyFieldConfigSchema>
    // `blocks` is loosely typed in the runtime schema (see module.ts);
    // narrowed back to `BlockDefinition[]` here for compile-time ergonomics.
    blocks: BaseFieldConfig &
      Omit<z.infer<typeof blocksFieldConfigSchema>, 'blocks'> & { blocks: BlockDefinition[] }
  }
}

export { Collection, Document, Taxonomy } from './entities.js'
export type {
  CollectionConfig,
  DocumentConfig,
  TaxonomyInput,
} from './entities.js'

// Field builders + inference, re-exported so configs can import everything
// they need from `@kon10/content`.
export {
  z,
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
} from 'kon10'

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
