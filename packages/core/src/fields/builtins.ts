/**
 * Core built-in field type registrations.
 *
 * This module is a side-effect import. It must be loaded once at bootstrap
 * (via `bootstrap/index.ts`) before any module `onInit` runs, so that the
 * registry already has the base types when modules register their own.
 */

import { z } from 'zod'
import { registerFieldType } from './registry.js'

// Each schema is exported so `types.ts` can derive its `FieldTypeMap` entry
// via `z.infer` instead of hand-duplicating the shape — these are the single
// source of truth for both runtime validation and the compile-time type.

export const textFieldConfigSchema = z.object({
  type: z.literal('text'),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
})

export const numberFieldConfigSchema = z.object({
  type: z.literal('number'),
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
})

export const booleanFieldConfigSchema = z.object({ type: z.literal('boolean') })

export const dateFieldConfigSchema = z.object({ type: z.literal('date') })

export const selectFieldConfigSchema = z.object({
  type: z.literal('select'),
  options: z.array(z.string()),
  many: z.boolean().optional(),
})

export const richtextFieldConfigSchema = z.object({ type: z.literal('richtext') })

export const relationshipFieldConfigSchema = z.object({
  type: z.literal('relationship'),
  to: z.string(),
  many: z.boolean().optional(),
})

// `fields` is validated loosely at runtime (`z.record(z.string(), z.unknown())`): the
// field registry is open/extensible, so a fully faithful recursive schema of
// "any registered field type" can't be expressed statically here. The
// `FieldTypeMap` entries for `group`/`array` in `types.ts` override this one
// property back to `Field[]` for compile-time ergonomics.
export const groupFieldConfigSchema = z.object({
  type: z.literal('group'),
  fields: z.array(z.record(z.string(), z.unknown())),
})

export const arrayFieldConfigSchema = z.object({
  type: z.literal('array'),
  fields: z.array(z.record(z.string(), z.unknown())),
  /**
   * Name of a child field whose value labels each item's collapsed header
   * (e.g. `'label'`) instead of the default "Item 1", "Item 2", … A missing
   * or empty value on a given item falls back to the numbered label.
   */
  useAsTitle: z.string().optional(),
})

registerFieldType({
  configSchema: textFieldConfigSchema,
  buildDataSchema: (config) => {
    let s = z.string()
    if (config.minLength != null) s = s.min(config.minLength as number)
    if (config.maxLength != null) s = s.max(config.maxLength as number)
    return s
  },
})

registerFieldType({
  configSchema: numberFieldConfigSchema,
  buildDataSchema: (config) => {
    let s = (config.integer as boolean | undefined) ? z.number().int() : z.number()
    if (config.min != null) s = s.min(config.min as number)
    if (config.max != null) s = s.max(config.max as number)
    return s
  },
})

registerFieldType({
  configSchema: booleanFieldConfigSchema,
  buildDataSchema: () => z.boolean(),
})

registerFieldType({
  configSchema: dateFieldConfigSchema,
  buildDataSchema: () => z.coerce.date(),
})

registerFieldType({
  configSchema: selectFieldConfigSchema,
  buildDataSchema: (config) => {
    const options = config.options as string[]
    const [first, ...rest] = options
    const base: z.ZodType =
      first === undefined ? z.string() : z.enum([first, ...rest] as [string, ...string[]])
    return (config.many as boolean | undefined) ? z.array(base) : base
  },
})

registerFieldType({
  configSchema: richtextFieldConfigSchema,
  buildDataSchema: () => z.string(),
})

registerFieldType({
  configSchema: relationshipFieldConfigSchema,
  buildDataSchema: (config) =>
    (config.many as boolean | undefined) ? z.array(z.string()) : z.string(),
})

registerFieldType({
  configSchema: groupFieldConfigSchema,
  buildDataSchema: (config, registry) =>
    registry.buildDocumentSchema(config.fields as Array<Record<string, unknown>>),
})

registerFieldType({
  configSchema: arrayFieldConfigSchema,
  buildDataSchema: (config, registry) =>
    z.array(registry.buildDocumentSchema(config.fields as Array<Record<string, unknown>>)),
})
