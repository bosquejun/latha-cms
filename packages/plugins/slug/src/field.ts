/**
 * The `slug` field type — Zod-first config schema + data schema.
 *
 * The stored value is a kebab-case path (`hello-world`,
 * `2026/07/hello-world`) — or, in `nested` mode, a single kebab-case leaf
 * segment (`installation`) whose full URL lives in the plugin-owned path
 * field (see plugin.ts). The field is deliberately never `required`:
 * document validation runs *before* `beforeCreate` hooks, so a required slug
 * would reject the empty payload the generation hook is about to fill. The
 * hook guarantees a value whenever the template resolves to one.
 */

import { z } from 'zod'
import type { FieldTypeEntry } from '@kon10/core'
import { SLUG_PATH_PATTERN, SLUG_SEGMENT_PATTERN } from './slugify.js'
import { slugTokenSchema } from './template.js'

export const slugFieldConfigSchema = z.object({
  type: z.literal('slug'),
  /**
   * Generation template: `{field}`, `{field:format}`, `{ref.path}` tokens and
   * literal text (see template.ts). A bare field name means `{name}`.
   */
  from: z.string(),
  maxLength: z.number().int().positive().optional(),
  /**
   * Nested-page mode: the slug stores only this document's own URL segment,
   * and the plugin maintains a derived full path (`parent.path + '/' + slug`)
   * in a hidden, unique sibling field it injects at onInit. `parent` names
   * the sibling relationship field pointing back at the same entity.
   */
  nested: z
    .object({
      /** Sibling self-referential relationship field naming the parent doc. */
      parent: z.string(),
      /** Name of the injected full-path field. Default `'path'`. */
      pathField: z.string().optional(),
      /**
       * The entity's own slug, stamped by `slugPlugin` at onInit so the Studio
       * renderer knows where to fetch the selected parent. Not hand-written.
       */
      to: z.string().optional(),
    })
    .optional(),
  /**
   * Compiled form of `from`, stamped by `slugPlugin` at onInit once sibling
   * fields are known. Not written by hand.
   */
  tokens: z.array(slugTokenSchema).optional(),
})

export const slugFieldEntry: FieldTypeEntry = {
  configSchema: slugFieldConfigSchema,
  buildDataSchema: (config) => {
    let schema = config.nested
      ? z
          .string()
          .regex(
            SLUG_SEGMENT_PATTERN,
            'Must be a URL segment: lowercase letters, numbers and hyphens.',
          )
      : z
          .string()
          .regex(
            SLUG_PATH_PATTERN,
            'Must be a URL slug: lowercase letters, numbers and hyphens, with optional / segments.',
          )
    if (typeof config.maxLength === 'number') schema = schema.max(config.maxLength)
    return schema
  },
}
