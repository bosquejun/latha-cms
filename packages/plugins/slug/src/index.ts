/**
 * @latha/slug — template-based slug generation as a core `Plugin`.
 *
 * ```ts
 * import { slug, slugPlugin } from '@latha/slug'
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
 * The admin renderer ships client-side via `@latha/slug/admin`
 * (`Plugin.admin.ui`); the field type itself is registered server-side in
 * `slugPlugin().onInit` — client-side validation falls back to `z.unknown()`
 * by design (same as `media`/`taxonomy`), the path regex runs on the server.
 */

import type { BaseFieldConfig } from '@latha/core'
import type { SlugToken } from './template.js'

// Augment core's FieldTypeMap so consumers get the slug field type.
declare module '@latha/core' {
  interface FieldTypeMap {
    slug: BaseFieldConfig & {
      type: 'slug'
      from: string
      maxLength?: number
      tokens?: SlugToken[]
    }
  }
}

export { slugPlugin } from './plugin.js'
export { slug } from './builders.js'
export { slugify, slugifyPath, formatDate, SLUG_PATH_PATTERN } from './slugify.js'
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
export { createSlugHooks, ensureUniqueSlug, type SlugHookTarget } from './hooks.js'
