/**
 * `slugPlugin()` — the core `Plugin` that wires slug generation into every
 * entity carrying a `slug()` field, whichever module contributed the entity.
 *
 * At `onInit` (after all module onInits, before migrate) it:
 * 1. registers the `slug` field type,
 * 2. compiles each slug field's `from` template against its sibling fields,
 *    stamping the result onto the field config (`tokens`) so the Studio
 *    renderer interprets the exact same tokens, and
 * 3. unshifts beforeCreate/beforeUpdate hooks (closing over `cms.db` for
 *    uniqueness checks) so user-authored hooks observe the final slug.
 *
 * For `nested` slug fields it additionally validates the parent field (a
 * single-valued self-referential reference), injects the hidden, unique
 * full-path field the hooks maintain, flips the slug field's own `unique`
 * off (the leaf is only sibling-unique; the path column carries the UNIQUE
 * backstop), stamps the resolved nested config (`pathField`, `to`) for the
 * Studio renderer, and wires the afterUpdate descendant-path cascade.
 *
 * Detection is by field *type* `'slug'`, never by field name — an entity's
 * hand-rolled `slug: text()` field is left alone. Top-level fields only:
 * slug fields nested in group/array are out of scope.
 */

import type { AnyEntity, Kon10Instance, Plugin } from '@kon10/core'
import { slugFieldEntry } from './field.js'
import { createSlugHooks, type SlugHookTarget, type SlugNestedTarget } from './hooks.js'
import { compileTokens, parseTemplate } from './template.js'

/**
 * Validate a slug field's `nested` config against its entity, inject the
 * plugin-owned path field, and stamp the resolved config back onto the field
 * for the Studio renderer. Returns the resolved hook target. Throws at boot on
 * misconfiguration — config errors, surfaced early.
 */
function compileNested(
  entity: AnyEntity,
  field: Record<string, unknown>,
  context: string,
): SlugNestedTarget {
  const nested = field.nested as { parent: string; pathField?: string }

  if (entity.cardinality !== 'many') {
    throw new Error(`Nested slug in ${context}: entity "${entity.slug}" is a singleton — nesting needs a list entity.`)
  }
  if (field.unique === true) {
    throw new Error(
      `Nested slug in ${context}: drop \`unique\` — the leaf segment is only unique among siblings; the derived path field carries the UNIQUE constraint.`,
    )
  }

  const fields = entity.fields as Array<Record<string, unknown>>
  const parent = fields.find((f) => f.name === nested.parent)
  if (!parent) {
    throw new Error(`Nested slug in ${context}: parent field "${nested.parent}" does not exist.`)
  }
  if (parent.to !== entity.slug) {
    throw new Error(
      `Nested slug in ${context}: parent field "${nested.parent}" must be a self-referential reference (to: '${entity.slug}'), got "${String(parent.to ?? parent.type)}".`,
    )
  }
  if (parent.many === true) {
    throw new Error(`Nested slug in ${context}: parent field "${nested.parent}" must be single-valued.`)
  }

  const pathField = nested.pathField ?? 'path'
  if (fields.some((f) => f.name === pathField)) {
    throw new Error(
      `Nested slug in ${context}: field "${pathField}" already exists — the plugin owns the path field; pick another name via nested.pathField.`,
    )
  }

  // The derived full URL: hidden from the Studio form, UNIQUE at the column
  // level as the concurrent-write backstop (never `required` — it is filled
  // by the same hooks that fill the slug, after validation).
  fields.push({ name: pathField, type: 'text', unique: true, meta: { hidden: true } })

  // The leaf segment is only unique among siblings — no UNIQUE column.
  field.unique = false
  // Stamp the resolved config so the Studio renderer can fetch the selected
  // parent (`to`) and read its path (`pathField`) without re-deriving.
  field.nested = { parent: nested.parent, pathField, to: entity.slug }
  // A single-valued self-referential parent is exactly what the flag means.
  entity.hierarchical ??= true

  return { parentField: nested.parent, pathField }
}

export function slugPlugin(): Plugin {
  return {
    name: 'slug',
    studio: { ui: '@kon10/slug/studio' },
    onInit(cms: Kon10Instance) {
      cms.registerFieldType(slugFieldEntry)

      for (const entity of cms.entities) {
        const targets: SlugHookTarget[] = []
        for (const field of entity.fields as Array<Record<string, unknown>>) {
          if (field.type !== 'slug') continue
          const context = `${entity.slug}.${String(field.name)}`
          const tokens = compileTokens(
            parseTemplate(String(field.from)),
            entity.fields as Array<Record<string, unknown>>,
            context,
          )
          field.tokens = tokens
          targets.push({
            name: String(field.name),
            tokens,
            maxLength: typeof field.maxLength === 'number' ? field.maxLength : undefined,
            nested: field.nested ? compileNested(entity, field, context) : undefined,
          })
        }
        if (targets.length === 0) continue

        const { beforeCreate, beforeUpdate, afterUpdate } = createSlugHooks(
          cms.db,
          entity.slug,
          targets,
        )
        entity.hooks ??= {}
        ;(entity.hooks.beforeCreate ??= []).unshift(beforeCreate)
        ;(entity.hooks.beforeUpdate ??= []).unshift(beforeUpdate)
        if (afterUpdate) (entity.hooks.afterUpdate ??= []).unshift(afterUpdate)
      }
    },
  }
}
