/**
 * Seeds a field's starting value from its declared `defaultValue` (or a
 * type-appropriate blank). Used for a brand-new top-level document, where
 * the top-level `cleanValues` pass (in `EntityForm`) gets a chance to
 * normalize an untouched `''`/`false`/`[]` back to `null`/absent before
 * submit.
 */
import type { Field } from '@kon10/core'

export function defaultForField(field: Field): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue
  switch (field.type as string) {
    case 'boolean':
      return false
    case 'number':
      return ''
    case 'array':
    case 'blocks':
      return []
    case 'group':
      return sparseDefaults(fieldChildren(field))
    default:
      return ''
  }
}

/** Builds a `{ [field.name]: defaultForField(field) }` object for a field list. */
export function buildFieldDefaults(fields: Field[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) values[field.name] = defaultForField(field)
  return values
}

function fieldChildren(field: Field): Field[] {
  const children = (field as Record<string, unknown>).fields
  return Array.isArray(children) ? (children as Field[]) : []
}

/**
 * Seeds only fields that (recursively) declare an explicit `defaultValue` —
 * e.g. a color swatch's starting hex — so it shows up right away. Every
 * renderer already treats an absent value as its own blank state, so an
 * untouched field with no default stays absent rather than getting a literal
 * `''`/`false`/`[]`, which can fail a stricter schema (e.g. a `z.url()` field
 * rejecting an empty string) that never reaches a top-level `cleanValues`
 * pass — used both for a `group`'s children and for a brand-new `array` item,
 * neither of which get that top-level normalization.
 */
export function sparseDefaults(fields: Field[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      defaults[field.name] = field.defaultValue
    } else if (field.type === 'group') {
      const nested = sparseDefaults(fieldChildren(field))
      if (Object.keys(nested).length > 0) defaults[field.name] = nested
    }
  }
  return defaults
}
