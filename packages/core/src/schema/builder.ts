/**
 * Zod schema builder — the bridge.
 *
 * Field definitions compile to Zod schemas at init time. The resulting schema
 * is the single validation layer: it powers server-function `.validator()`
 * calls, TanStack Form validation, and `z.infer<>` type inference. Do not add
 * validation logic anywhere else.
 */

import { z } from 'zod'
import type {
  ArrayField,
  Field,
  GroupField,
  NumberField,
  SelectField,
  TextField,
} from '../types/field.js'

function buildTextSchema(field: TextField): z.ZodTypeAny {
  let schema = z.string()
  if (field.minLength !== undefined) schema = schema.min(field.minLength)
  if (field.maxLength !== undefined) schema = schema.max(field.maxLength)
  return schema
}

function buildNumberSchema(field: NumberField): z.ZodTypeAny {
  let schema = field.integer ? z.number().int() : z.number()
  if (field.min !== undefined) schema = schema.min(field.min)
  if (field.max !== undefined) schema = schema.max(field.max)
  return schema
}

function buildSelectSchema(field: SelectField): z.ZodTypeAny {
  // z.enum needs a non-empty tuple; fall back to z.string() for empty options.
  const [first, ...rest] = field.options
  const base: z.ZodTypeAny =
    first === undefined ? z.string() : z.enum([first, ...rest])
  return field.many ? z.array(base) : base
}

function buildGroupSchema(field: GroupField): z.ZodTypeAny {
  return buildZodSchema(field.fields)
}

function buildArraySchema(field: ArrayField): z.ZodTypeAny {
  return z.array(buildZodSchema(field.fields))
}

/** Compile a single field to its (pre-required/optional) Zod schema. */
function buildFieldSchema(field: Field): z.ZodTypeAny {
  switch (field.type) {
    case 'text':
    case 'richtext':
      return field.type === 'text' ? buildTextSchema(field) : z.string()
    case 'number':
      return buildNumberSchema(field)
    case 'boolean':
      return z.boolean()
    case 'date':
      // Accept Date instances or ISO strings; coerce to Date.
      return z.coerce.date()
    case 'select':
      return buildSelectSchema(field)
    case 'media':
      // Stored as a media id / url reference.
      return z.string()
    case 'relationship':
    case 'taxonomy':
      return field.many ? z.array(z.string()) : z.string()
    case 'group':
      return buildGroupSchema(field)
    case 'array':
      return buildArraySchema(field)
    default: {
      // Exhaustiveness guard — `field` is `never` here if all cases are handled.
      const exhaustive: never = field
      throw new Error(
        `Unknown field type: ${(exhaustive as Field).type}`,
      )
    }
  }
}

/**
 * Build a `z.ZodObject` from a list of field definitions.
 *
 * Required fields are kept as-is; optional fields are wrapped in
 * `.optional()`. Fields carrying a `defaultValue` get `.default(...)` so the
 * value is filled in on parse.
 */
export function buildZodSchema(fields: Field[]): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {}

  for (const field of fields) {
    let schema = buildFieldSchema(field)

    if (field.defaultValue !== undefined) {
      schema = schema.default(field.defaultValue)
    } else if (!field.required) {
      schema = schema.optional()
    }

    shape[field.name] = schema
  }

  return z.object(shape)
}

/** Infer the TypeScript type of a built schema. */
export type InferFields<T extends z.ZodObject<z.ZodRawShape>> = z.infer<T>
