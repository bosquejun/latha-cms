/**
 * @latha/content — ContentModule and the Collection / Document / Taxonomy
 * entity factories, plus the config-driven content API.
 */

import type { BaseFieldConfig } from '@latha/core'

// Augment core's FieldTypeMap so consumers get taxonomy field types automatically.
declare module '@latha/core' {
  interface FieldTypeMap {
    taxonomy: BaseFieldConfig & { type: 'taxonomy'; to: string; many?: boolean }
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

// taxonomy builder lives in @latha/content — the field type is owned here.
export { taxonomy } from './builders.js'

export { ContentModule } from './module.js'
export type { ContentModuleConfig } from './module.js'

export { createContentApi } from './api.js'
export type {
  ContentApi,
  ContentApiOptions,
  JsonDoc,
  JsonTermNode,
} from './api.js'
