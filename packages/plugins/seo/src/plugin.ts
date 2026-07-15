/**
 * `seoPlugin()` — the core `Plugin` that wires a search/social metadata field
 * into entities, whichever module contributed them.
 *
 * At `onInit` (after all module onInits, before migrate — so the injected
 * field gets a storage column for free) it:
 * 1. registers the `seo` field type,
 * 2. injects an `seo` field into every entity matched by `inject` that does
 *    not already declare one (config-level opt-in, for "add SEO to all my
 *    pages" without touching each entity),
 * 3. for each `seo` field (hand-written via `seo()` or injected), resolves its
 *    `from` derivation map (falling back to a value inferred from the entity's
 *    own fields) and stamps the resolved config back onto the field so the
 *    Studio renderer and the hooks agree, and
 * 4. appends beforeCreate/beforeUpdate hooks that backfill blank SEO
 *    sub-fields from the final document data.
 *
 * Detection is by field *type* `'seo'`, never by name — a hand-rolled
 * `seo: group(...)` is left untouched. Top-level fields only.
 */

import type { AnyEntity, Field, Kon10Instance, Plugin } from '@kon10/core'
import { seoFieldEntry } from './field.js'
import { inferFrom } from './defaults.js'
import { createSeoHooks, type SeoHookTarget } from './hooks.js'

export interface SeoPluginOptions {
  /**
   * Which entities get an `seo` field injected automatically. A list of entity
   * slugs, or a predicate over the entity (e.g. `(e) => e.kind === 'document'`
   * to cover every content singleton). Entities that already declare an `seo`
   * field are skipped either way. Omit to inject nowhere — only hand-written
   * `seo()` fields are wired.
   */
  inject?: string[] | ((entity: AnyEntity) => boolean)
  /** Default `titleTemplate` for every wired field (a field's own value wins). */
  titleTemplate?: string
  /** Default `social` toggle for injected fields. Default true. */
  social?: boolean
  /** Default `robots` toggle for injected fields. Default true. */
  robots?: boolean
  /**
   * Default derivation map merged under each field's own `from` and the
   * per-entity inferred default. Lets you force, say, `{ description:
   * '{summary}' }` everywhere without repeating it.
   */
  from?: Record<string, string>
}

/** Does this entity opt into an injected SEO field? */
function matchesInject(entity: AnyEntity, inject: SeoPluginOptions['inject']): boolean {
  if (!inject) return false
  return typeof inject === 'function' ? inject(entity) : inject.includes(entity.slug)
}

/** The `seo` field on an entity, if any — detected by type, never by name. */
function findSeoField(entity: AnyEntity): Record<string, unknown> | undefined {
  return (entity.fields as Array<Record<string, unknown>>).find((f) => f.type === 'seo')
}

export function seoPlugin(options: SeoPluginOptions = {}): Plugin {
  return {
    name: 'seo',
    studio: { ui: '@kon10/seo/studio' },
    onInit(cms: Kon10Instance) {
      cms.registerFieldType(seoFieldEntry)

      for (const entity of cms.entities) {
        let field = findSeoField(entity)

        // Config-level injection: add a field to opted-in entities that lack one.
        if (!field && matchesInject(entity, options.inject)) {
          field = {
            name: 'seo',
            type: 'seo',
            ...(options.social != null ? { social: options.social } : {}),
            ...(options.robots != null ? { robots: options.robots } : {}),
            meta: { group: 'SEO & Meta', label: 'SEO', description: 'Search & social metadata.' },
          }
          ;(entity.fields as Field[]).push(field as unknown as Field)
        }

        if (!field) continue

        // Resolve the derivation map: the field's own `from` wins, then the
        // plugin-wide `from`, then the per-entity inferred default.
        const from = { ...inferFrom(entity), ...options.from, ...(field.from as Record<string, string> | undefined) }
        const titleTemplate = (field.titleTemplate as string | undefined) ?? options.titleTemplate

        // Stamp the resolved config back so the Studio renderer reads the same
        // `from`/`titleTemplate` the hooks use (parity with how slugPlugin
        // stamps its compiled tokens).
        field.from = from
        if (titleTemplate != null) field.titleTemplate = titleTemplate

        const target: SeoHookTarget = { fieldName: String(field.name), from, titleTemplate }
        const { beforeCreate, beforeUpdate } = createSeoHooks(target)

        // Append (not unshift): derive from the most-final data, after any
        // user/slug hooks have run.
        entity.hooks ??= {}
        ;(entity.hooks.beforeCreate ??= []).push(beforeCreate)
        ;(entity.hooks.beforeUpdate ??= []).push(beforeUpdate)
      }
    },
  }
}
