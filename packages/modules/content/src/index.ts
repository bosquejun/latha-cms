/**
 * @latha/content — ContentModule and the Collection / Document / Taxonomy
 * entity factories, plus the config-driven content API.
 */

export { Collection, Document, Taxonomy } from './entities.js'
export type {
  CollectionInput,
  DocumentInput,
  TaxonomyInput,
} from './entities.js'

export { ContentModule } from './module.js'
export type { ContentModuleConfig } from './module.js'

export { createContentApi } from './api.js'
export type {
  ContentApi,
  ContentApiOptions,
  JsonDoc,
  JsonTermNode,
} from './api.js'
