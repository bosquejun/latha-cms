/**
 * Evaluates a field's `meta.showIf` against its sibling scope — the enclosing
 * group/array item's values for a nested field, or the whole entity's values
 * for a top-level one. Fields with no `showIf` are always visible.
 */
import type { Field } from '@kon10/core'

export function isFieldVisible(field: Field, siblingValues: Record<string, unknown>): boolean {
  const condition = field.meta?.showIf
  if (!condition) return true
  const actual = siblingValues[condition.field]
  if (condition.equals !== undefined) return actual === condition.equals
  if (condition.in) return condition.in.includes(actual as string | number | boolean)
  return true
}
