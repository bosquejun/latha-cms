/**
 * The `slug` field type — Zod-first config schema + data schema.
 *
 * The stored value is a kebab-case path (`hello-world`,
 * `2026/07/hello-world`). The field is deliberately never `required`:
 * document validation runs *before* `beforeCreate` hooks, so a required slug
 * would reject the empty payload the generation hook is about to fill. The
 * hook guarantees a value whenever the template resolves to one.
 */

import { z } from 'zod'
import type { FieldTypeEntry } from '@latha/core'
import { SLUG_PATH_PATTERN } from './slugify.js'
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
   * Compiled form of `from`, stamped by `slugPlugin` at onInit once sibling
   * fields are known. Not written by hand.
   */
  tokens: z.array(slugTokenSchema).optional(),
})

export const slugFieldEntry: FieldTypeEntry = {
  configSchema: slugFieldConfigSchema,
  buildDataSchema: (config) => {
    let schema = z
      .string()
      .regex(
        SLUG_PATH_PATTERN,
        'Must be a URL slug: lowercase letters, numbers and hyphens, with optional / segments.',
      )
    if (typeof config.maxLength === 'number') schema = schema.max(config.maxLength)
    return schema
  },
}
