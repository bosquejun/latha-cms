/**
 * `seoPlugin()` — the core `Plugin` that wires a search-metadata field and a
 * social-graph field into entities, whichever module contributed them.
 *
 * At `onInit` (after all module onInits, before migrate — so the injected
 * fields get storage columns for free) it:
 * 1. registers the `seo` and `socialGraph` field types,
 * 2. injects each into every entity matched by `inject` that does not already
 *    declare it (config-level opt-in), placing `seo` in the "SEO" tab and
 *    `socialGraph` in the "Social Graph" tab,
 * 3. resolves each `seo` field's `from` derivation map (falling back to a value
 *    inferred from the entity's own fields) and stamps it back so the Studio
 *    renderer and the hooks agree,
 * 4. cross-links a `socialGraph` field to its sibling `seo` field (`seoField`)
 *    so the social previews can fall back to the search title/description, and
 * 5. appends beforeCreate/beforeUpdate hooks that backfill blank SEO
 *    sub-fields from the final document data.
 *
 * Detection is by field *type*, never by name — a hand-rolled `seo: group(...)`
 * is left untouched. Top-level fields only.
 */

import type { AnyEntity, Field, Kon10Instance, Plugin } from '@kon10/core'
import { seoFieldEntry, socialFieldEntry } from './field.js'
import { inferFrom } from './defaults.js'
import { createSeoHooks, type SeoHookTarget } from './hooks.js'

export interface SeoPluginOptions {
  /**
   * Which entities get `seo` + `socialGraph` fields injected automatically. A
   * list of entity slugs, or a predicate over the entity (e.g. `(e) => e.kind
   * === 'document'`). Entities that already declare a given field are skipped
   * for that field. Omit to inject nowhere — only hand-written fields are wired.
   */
  inject?: string[] | ((entity: AnyEntity) => boolean)
  /** Default `titleTemplate` for every wired `seo` field (a field's own value wins). */
  titleTemplate?: string
  /** Inject the `socialGraph` field alongside `seo`. Default true. */
  social?: boolean
  /** Default `robots` toggle for injected `seo` fields. Default true. */
  robots?: boolean
  /**
   * Default derivation map merged under each `seo` field's own `from` and the
   * per-entity inferred default.
   */
  from?: Record<string, string>
}

/** Does this entity opt into injected SEO fields? */
function matchesInject(entity: AnyEntity, inject: SeoPluginOptions['inject']): boolean {
  if (!inject) return false
  return typeof inject === 'function' ? inject(entity) : inject.includes(entity.slug)
}

/** The first field of a given type on an entity — detected by type, never by name. */
function findFieldByType(entity: AnyEntity, type: string): Record<string, unknown> | undefined {
  return (entity.fields as Array<Record<string, unknown>>).find((f) => f.type === type)
}

export function seoPlugin(options: SeoPluginOptions = {}): Plugin {
  const injectSocial = options.social !== false

  return {
    name: 'seo',
    studio: { ui: '@kon10/seo/studio' },
    onInit(cms: Kon10Instance) {
      cms.registerFieldType(seoFieldEntry)
      cms.registerFieldType(socialFieldEntry)

      for (const entity of cms.entities) {
        let seoField = findFieldByType(entity, 'seo')
        let socialField = findFieldByType(entity, 'socialGraph')
        const inject = matchesInject(entity, options.inject)

        // Config-level injection: add the fields to opted-in entities that lack them.
        if (!seoField && inject) {
          seoField = {
            name: 'seo',
            type: 'seo',
            ...(options.robots != null ? { robots: options.robots } : {}),
            meta: { group: 'SEO', label: 'SEO', description: 'Search engine metadata.' },
          }
          ;(entity.fields as Field[]).push(seoField as unknown as Field)
        }
        if (!socialField && inject && injectSocial) {
          socialField = {
            name: 'social',
            type: 'socialGraph',
            meta: { group: 'Social Graph', label: 'Social Graph', description: 'Open Graph & Twitter cards.' },
          }
          ;(entity.fields as Field[]).push(socialField as unknown as Field)
        }

        // Cross-link the social field to its sibling seo field so the OG/Twitter
        // previews can fall back to the search title/description.
        if (socialField && seoField) socialField.seoField = String(seoField.name)

        if (!seoField) continue

        // Resolve the derivation map: the field's own `from` wins, then the
        // plugin-wide `from`, then the per-entity inferred default.
        const from = {
          ...inferFrom(entity),
          ...options.from,
          ...(seoField.from as Record<string, string> | undefined),
        }
        const titleTemplate = (seoField.titleTemplate as string | undefined) ?? options.titleTemplate

        // Stamp the resolved config back so the Studio renderer reads the same
        // `from`/`titleTemplate` the hooks use (parity with slugPlugin).
        seoField.from = from
        if (titleTemplate != null) seoField.titleTemplate = titleTemplate

        const target: SeoHookTarget = { fieldName: String(seoField.name), from, titleTemplate }
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
