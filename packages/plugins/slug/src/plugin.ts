/**
 * `slugPlugin()` — the core `Plugin` that wires slug generation into every
 * entity carrying a `slug()` field, whichever module contributed the entity.
 *
 * At `onInit` (after all module onInits, before migrate) it:
 * 1. registers the `slug` field type,
 * 2. compiles each slug field's `from` template against its sibling fields,
 *    stamping the result onto the field config (`tokens`) so the admin
 *    renderer interprets the exact same tokens, and
 * 3. unshifts beforeCreate/beforeUpdate hooks (closing over `cms.db` for
 *    uniqueness checks) so user-authored hooks observe the final slug.
 *
 * Detection is by field *type* `'slug'`, never by field name — an entity's
 * hand-rolled `slug: text()` field is left alone. Top-level fields only:
 * slug fields nested in group/array are out of scope.
 */

import type { LathaInstance, Plugin } from '@latha/core'
import { slugFieldEntry } from './field.js'
import { createSlugHooks, type SlugHookTarget } from './hooks.js'
import { compileTokens, parseTemplate } from './template.js'

export function slugPlugin(): Plugin {
  return {
    name: 'slug',
    admin: { ui: '@latha/slug/admin' },
    onInit(cms: LathaInstance) {
      cms.registerFieldType(slugFieldEntry)

      for (const entity of cms.entities) {
        const targets: SlugHookTarget[] = []
        for (const field of entity.fields as Array<Record<string, unknown>>) {
          if (field.type !== 'slug') continue
          const tokens = compileTokens(
            parseTemplate(String(field.from)),
            entity.fields as Array<Record<string, unknown>>,
            `${entity.slug}.${String(field.name)}`,
          )
          field.tokens = tokens
          targets.push({
            name: String(field.name),
            tokens,
            maxLength: typeof field.maxLength === 'number' ? field.maxLength : undefined,
          })
        }
        if (targets.length === 0) continue

        const { beforeCreate, beforeUpdate } = createSlugHooks(cms.db, entity.slug, targets)
        entity.hooks ??= {}
        ;(entity.hooks.beforeCreate ??= []).unshift(beforeCreate)
        ;(entity.hooks.beforeUpdate ??= []).unshift(beforeUpdate)
      }
    },
  }
}
