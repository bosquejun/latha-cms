/**
 * Backend derivation hooks.
 *
 * For every entity carrying an `seo` field, `seoPlugin` wires the hooks built
 * here into `beforeCreate`/`beforeUpdate`. They *backfill only* — an SEO
 * sub-field the editor left blank is filled from its `from` template over the
 * document's sibling values; a value the editor typed is never touched. That
 * keeps the pass idempotent across updates (re-running it changes nothing once
 * fields are populated) and means the site-wide `titleTemplate` is applied
 * only to a title we derived, never wrapping a hand-written one twice.
 */

import type { HookFn } from 'kon10'
import type { SeoData } from './schema.js'
import { applyTitleTemplate, resolveTemplate } from './template.js'

export interface SeoHookTarget {
  /** Name of the `seo` field on the entity (usually `'seo'`). */
  fieldName: string
  /** Resolved derivation map: SEO sub-field → `{sibling}` template. */
  from: Record<string, string>
  /** Site-wide title template applied to a derived title only. */
  titleTemplate?: string
}

/** Read the current SEO object off a payload, tolerating null/absent/garbage. */
function currentSeo(data: Record<string, unknown>, fieldName: string): SeoData {
  const value = data[fieldName]
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as SeoData) } : {}
}

/** True when an SEO sub-field is empty and therefore eligible for backfill. */
function isBlank(value: unknown): boolean {
  return value == null || value === ''
}

/**
 * Backfill blank SEO sub-fields from the `from` templates. Returns the payload
 * unchanged when nothing derives, so an entity whose templates all resolve
 * empty never gains a stray empty `seo: {}` object.
 */
export function deriveSeo(
  data: Record<string, unknown>,
  target: SeoHookTarget,
): Record<string, unknown> {
  const seo = currentSeo(data, target.fieldName)
  let changed = false

  for (const [sub, template] of Object.entries(target.from)) {
    if (!isBlank((seo as Record<string, unknown>)[sub])) continue
    let derived = resolveTemplate(template, data)
    if (derived === '') continue
    if (sub === 'title') derived = applyTitleTemplate(derived, target.titleTemplate)
    ;(seo as Record<string, unknown>)[sub] = derived
    changed = true
  }

  if (!changed && isBlank(data[target.fieldName])) return data
  return { ...data, [target.fieldName]: seo }
}

/** Build the `beforeCreate`/`beforeUpdate` hooks for one `seo` field target. */
export function createSeoHooks(target: SeoHookTarget): {
  beforeCreate: HookFn
  beforeUpdate: HookFn
} {
  const run: HookFn = ({ data }) => deriveSeo(data as Record<string, unknown>, target)
  return { beforeCreate: run, beforeUpdate: run }
}
