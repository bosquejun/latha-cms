/**
 * @kon10/slug — template-based slug generation as a core `Plugin`.
 *
 * ```ts
 * import { slug, slugPlugin } from '@kon10/slug'
 *
 * defineConfig({
 *   plugins: [slugPlugin()],
 *   modules: [ContentModule({ entities: [Collection({
 *     slug: 'posts',
 *     fields: {
 *       title: text({ required: true }),
 *       slug: slug({ from: '{title}' }),
 *     },
 *   })] })],
 * })
 * ```
 *
 * The Studio renderer ships client-side via `@kon10/slug/studio`
 * (`Plugin.studio.ui`); the field type itself is registered server-side in
 * `slugPlugin().onInit` — client-side validation falls back to `z.unknown()`
 * by design (same as `media`/`taxonomy`), the path regex runs on the server.
 */

import type { BaseFieldConfig } from '@kon10/core'
import type { SlugToken } from './template.js'

// Augment core's FieldTypeMap so consumers get the slug field type.
declare module '@kon10/core' {
  interface FieldTypeMap {
    slug: BaseFieldConfig & {
      type: 'slug'
      from: string
      maxLength?: number
      nested?: { parent: string; pathField?: string; to?: string }
      tokens?: SlugToken[]
    }
  }
}

export { slugPlugin } from './plugin.js'
export { slug } from './builders.js'
export {
  slugify,
  slugifyPath,
  formatDate,
  SLUG_PATH_PATTERN,
  SLUG_SEGMENT_PATTERN,
} from './slugify.js'
export { slugFieldConfigSchema, slugFieldEntry } from './field.js'
export {
  parseTemplate,
  compileTokens,
  resolveTokens,
  renderTokenValue,
  slugTokenSchema,
  type SlugToken,
  type RawSlugToken,
  type TokenContext,
} from './template.js'
export {
  createSlugHooks,
  ensureUniqueSlug,
  resolveAncestorPath,
  cascadeDescendantPaths,
  type SlugHookTarget,
  type SlugNestedTarget,
  type SlugUniqueScope,
} from './hooks.js'
