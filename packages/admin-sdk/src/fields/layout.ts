/**
 * Row layout for a flat field list — shared by `EntityForm`'s main column and
 * `GroupField`'s nested fieldset, so `meta.width: 'half'` pairs the same way
 * whether a field sits at the top level or inside a `group()`.
 */
import type { Field } from '@kon10/core'

/** A row of one full-width field, or two paired `'half'`-width fields. */
export type FieldRow = [Field] | [Field, Field]

/**
 * Pair up consecutive `meta.width: 'half'` fields into two-up rows; every
 * other field (including a lone trailing `'half'`) gets its own full-width
 * row. Order-preserving — pairing only ever looks at the immediately
 * preceding field.
 */
export function layoutRows(fields: Field[]): FieldRow[] {
  const rows: FieldRow[] = []
  let pendingHalf: Field | undefined
  for (const field of fields) {
    if (field.meta?.width === 'half') {
      if (pendingHalf) {
        rows.push([pendingHalf, field])
        pendingHalf = undefined
      } else {
        pendingHalf = field
      }
      continue
    }
    if (pendingHalf) {
      rows.push([pendingHalf])
      pendingHalf = undefined
    }
    rows.push([field])
  }
  if (pendingHalf) rows.push([pendingHalf])
  return rows
}
