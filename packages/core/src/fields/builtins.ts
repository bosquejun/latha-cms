/**
 * Core built-in field type registrations.
 *
 * This module is a side-effect import. It must be loaded once at bootstrap
 * (via `bootstrap/index.ts`) before any module `onInit` runs, so that the
 * registry already has the base types when modules register their own.
 */

import { z } from 'zod'
import { registerFieldType } from './registry.js'

registerFieldType({
  configSchema: z.object({
    type: z.literal('text'),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
  }),
  buildDataSchema: (config) => {
    let s = z.string()
    if (config.minLength != null) s = s.min(config.minLength as number)
    if (config.maxLength != null) s = s.max(config.maxLength as number)
    return s
  },
})

registerFieldType({
  configSchema: z.object({
    type: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  }),
  buildDataSchema: (config) => {
    let s = (config.integer as boolean | undefined) ? z.number().int() : z.number()
    if (config.min != null) s = s.min(config.min as number)
    if (config.max != null) s = s.max(config.max as number)
    return s
  },
})

registerFieldType({
  configSchema: z.object({ type: z.literal('boolean') }),
  buildDataSchema: () => z.boolean(),
})

registerFieldType({
  configSchema: z.object({ type: z.literal('date') }),
  buildDataSchema: () => z.coerce.date(),
})

registerFieldType({
  configSchema: z.object({
    type: z.literal('select'),
    options: z.array(z.string()),
    many: z.boolean().optional(),
  }),
  buildDataSchema: (config) => {
    const options = config.options as string[]
    const [first, ...rest] = options
    const base: z.ZodTypeAny =
      first === undefined ? z.string() : z.enum([first, ...rest] as [string, ...string[]])
    return (config.many as boolean | undefined) ? z.array(base) : base
  },
})

registerFieldType({
  configSchema: z.object({ type: z.literal('richtext') }),
  buildDataSchema: () => z.string(),
})

registerFieldType({
  configSchema: z.object({
    type: z.literal('relationship'),
    to: z.string(),
    many: z.boolean().optional(),
  }),
  buildDataSchema: (config) =>
    (config.many as boolean | undefined) ? z.array(z.string()) : z.string(),
})

registerFieldType({
  configSchema: z.object({
    type: z.literal('group'),
    fields: z.array(z.record(z.unknown())),
  }),
  buildDataSchema: (config, registry) =>
    registry.buildDocumentSchema(config.fields as Array<Record<string, unknown>>),
})

registerFieldType({
  configSchema: z.object({
    type: z.literal('array'),
    fields: z.array(z.record(z.unknown())),
  }),
  buildDataSchema: (config, registry) =>
    z.array(registry.buildDocumentSchema(config.fields as Array<Record<string, unknown>>)),
})
