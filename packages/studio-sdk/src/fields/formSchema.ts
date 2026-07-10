/**
 * Client-side form validation schema.
 *
 * `buildZodSchema(fields)` already rebuilds the document schema in the
 * browser from the literal field configs (core's built-in types register on
 * `@kon10/core` import; module-owned types fall back to `z.unknown()` — real
 * validation always runs on the server).
 *
 * Fields defined with the builders' `schema` escape hatch carry an extra
 * `jsonSchema` property on the wire (stamped by `@kon10/start`'s `describe()`
 * via `z.toJSONSchema`) — the live Zod schema itself never leaves the server.
 * This module interprets the common JSON Schema constraints back into Zod so
 * the form pre-validates them too, and layers the result over the base
 * schema. Anything the interpreter doesn't understand degrades to the base
 * field schema; the server remains the source of truth.
 */

import { buildZodSchema, z, type Field } from '@kon10/core'

/** The wire shape of a field descriptor that may carry a JSON Schema mirror. */
type WireField = Field & { jsonSchema?: Record<string, unknown> }

/**
 * Structural view over ZodString and the v4 format classes (ZodEmail,
 * ZodURL, …): they all carry min/max/regex but don't share a nominal base
 * that exposes them.
 */
interface StringLike extends z.ZodType {
  min(n: number): StringLike
  max(n: number): StringLike
  regex(r: RegExp): StringLike
}

function stringFromJsonSchema(js: Record<string, unknown>): z.ZodType {
  let s: StringLike
  switch (js.format) {
    case 'email':
      s = z.email()
      break
    case 'uri':
      s = z.url()
      break
    case 'uuid':
      s = z.uuid()
      break
    default:
      s = z.string()
  }
  if (typeof js.minLength === 'number') s = s.min(js.minLength)
  if (typeof js.maxLength === 'number') s = s.max(js.maxLength)
  // Skip the pattern when a format already implies one (z.email() etc. ship
  // their own); double-anchoring a serialized pattern risks subtle mismatch.
  if (typeof js.pattern === 'string' && js.format === undefined) {
    try {
      s = s.regex(new RegExp(js.pattern))
    } catch {
      // Unparseable pattern (exotic flags/escapes) — leave it to the server.
    }
  }
  return s
}

function numberFromJsonSchema(js: Record<string, unknown>): z.ZodType {
  let s = js.type === 'integer' ? z.number().int() : z.number()
  if (typeof js.minimum === 'number') s = s.min(js.minimum)
  if (typeof js.maximum === 'number') s = s.max(js.maximum)
  if (typeof js.exclusiveMinimum === 'number') s = s.gt(js.exclusiveMinimum)
  if (typeof js.exclusiveMaximum === 'number') s = s.lt(js.exclusiveMaximum)
  if (typeof js.multipleOf === 'number') s = s.multipleOf(js.multipleOf)
  return s
}

/**
 * Best-effort JSON Schema → Zod for the constraint vocabulary
 * `z.toJSONSchema` emits for scalar field schemas. Returns undefined when the
 * shape isn't recognized, in which case the caller keeps the base schema.
 */
export function zodFromJsonSchema(js: Record<string, unknown>): z.ZodType | undefined {
  if (Array.isArray(js.enum)) {
    const values = js.enum.filter((v): v is string => typeof v === 'string')
    if (values.length > 0 && values.length === js.enum.length) return z.enum(values)
    return undefined
  }
  switch (js.type) {
    case 'string':
      return stringFromJsonSchema(js)
    case 'number':
    case 'integer':
      return numberFromJsonSchema(js)
    case 'boolean':
      return z.boolean()
    default:
      return undefined
  }
}

/**
 * The Zod schema the Studio form validates against: the registry-built
 * document schema, with `jsonSchema`-carrying fields upgraded to their
 * interpreted constraints (same default/optional layering as the registry).
 */
export function buildFormSchema(fields: Field[]): z.ZodObject<z.ZodRawShape> {
  const base = buildZodSchema(fields as unknown as Array<Record<string, unknown>>)

  const overrides: Record<string, z.ZodType> = {}
  for (const field of fields as WireField[]) {
    if (!field.jsonSchema) continue
    let s = zodFromJsonSchema(field.jsonSchema)
    if (!s) continue
    if (field.defaultValue !== undefined) {
      s = s.default(field.defaultValue)
    } else if (!field.required) {
      // Mirrors the registry's optional/clear contract (see registry.ts).
      s = s.nullable().optional()
    }
    overrides[field.name] = s
  }

  return Object.keys(overrides).length > 0 ? base.extend(overrides) : base
}
