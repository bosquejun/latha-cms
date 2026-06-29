/**
 * Compile-time field type map — the extensibility seam.
 *
 * Core registers its 9 built-in field types here. Modules that add their own
 * field types augment this interface in their own module declaration files:
 *
 * ```ts
 * // @latha/content (taxonomy field)
 * declare module '@latha/core' {
 *   interface FieldTypeMap {
 *     taxonomy: BaseFieldConfig & { type: 'taxonomy'; to: string; many?: boolean }
 *   }
 * }
 * ```
 *
 * `FieldFromMap` and `FieldTypeKey` widen automatically whenever a module
 * augments `FieldTypeMap`, so the rest of the type system picks up new
 * field types without any changes to core.
 */

import type { BaseFieldConfig } from './registry.js'

export interface FieldTypeMap {
  text: BaseFieldConfig & { type: 'text'; minLength?: number; maxLength?: number }
  number: BaseFieldConfig & { type: 'number'; min?: number; max?: number; integer?: boolean }
  boolean: BaseFieldConfig & { type: 'boolean' }
  date: BaseFieldConfig & { type: 'date' }
  select: BaseFieldConfig & { type: 'select'; options: string[]; many?: boolean }
  richtext: BaseFieldConfig & { type: 'richtext' }
  relationship: BaseFieldConfig & { type: 'relationship'; to: string; many?: boolean }
  group: BaseFieldConfig & { type: 'group'; fields: FieldFromMap[] }
  array: BaseFieldConfig & { type: 'array'; fields: FieldFromMap[] }
}

/** Union of all registered field config types (core + any module augmentations). */
export type FieldFromMap = FieldTypeMap[keyof FieldTypeMap]

/** Union of all registered field type discriminants. */
export type FieldTypeKey = keyof FieldTypeMap

export type { BaseFieldConfig }
