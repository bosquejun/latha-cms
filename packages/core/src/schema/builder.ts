/**
 * Zod schema builder — thin wrapper around the field registry.
 *
 * Delegates to `fieldRegistry.buildDocumentSchema`, which uses each field
 * type's registered `buildDataSchema` function. The hardcoded switch that
 * previously lived here has been removed; add new field types via
 * `registerFieldType()` instead.
 */

import { z } from 'zod'
import type { Field } from '../types/field.js'
import { fieldRegistry } from '../fields/registry.js'

/**
 * Build a `z.ZodObject` from a list of field definitions.
 *
 * Required fields are kept as-is; optional fields are wrapped in
 * `.optional()`. Fields carrying a `defaultValue` get `.default(...)` so the
 * value is filled in on parse.
 */
export function buildZodSchema(fields: Field[]): z.ZodObject<z.ZodRawShape> {
  return fieldRegistry.buildDocumentSchema(
    fields as unknown as Array<Record<string, unknown>>,
  )
}

/** Infer the TypeScript type of a built schema. */
export type InferFields<T extends z.ZodObject<z.ZodRawShape>> = z.infer<T>
