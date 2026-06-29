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

/**
 * Open extensibility seam for richtext field Lexical configuration.
 *
 * Admin-SDK (or any package that owns a Lexical implementation) augments this
 * interface with concrete Lexical types. Core defines it empty so the `richtext`
 * field config can carry `lexicalConfig` without depending on Lexical itself.
 *
 * ```ts
 * // in @latha/admin-sdk
 * declare module '@latha/core' {
 *   interface RichTextExtensions {
 *     nodes?: Klass<LexicalNode>[]
 *     plugins?: ReactNode[]
 *     theme?: EditorThemeClasses
 *   }
 * }
 * ```
 */
export interface RichTextExtensions {}

export interface FieldTypeMap {
  text: BaseFieldConfig & { type: 'text'; minLength?: number; maxLength?: number }
  number: BaseFieldConfig & { type: 'number'; min?: number; max?: number; integer?: boolean }
  boolean: BaseFieldConfig & { type: 'boolean' }
  date: BaseFieldConfig & { type: 'date' }
  select: BaseFieldConfig & { type: 'select'; options: string[]; many?: boolean }
  richtext: BaseFieldConfig & { type: 'richtext'; lexicalConfig?: RichTextExtensions }
  relationship: BaseFieldConfig & { type: 'relationship'; to: string; many?: boolean }
  group: BaseFieldConfig & { type: 'group'; fields: FieldFromMap[] }
  array: BaseFieldConfig & { type: 'array'; fields: FieldFromMap[] }
}

/** Union of all registered field config types (core + any module augmentations). */
export type FieldFromMap = FieldTypeMap[keyof FieldTypeMap]

/** Union of all registered field type discriminants. */
export type FieldTypeKey = keyof FieldTypeMap

/**
 * Canonical `Field` alias — widens as modules augment `FieldTypeMap`.
 * Use this wherever the old `Field` union was used.
 */
export type Field = FieldFromMap

/**
 * Canonical `FieldType` alias — the union of all registered type discriminants.
 * Widens as modules augment `FieldTypeMap`.
 */
export type FieldType = FieldTypeKey

// Convenience aliases for specific built-in field config types.
// These exist so internal code (builders, renderers) can keep descriptive names.
export type TextField = FieldTypeMap['text']
export type NumberField = FieldTypeMap['number']
export type BooleanField = FieldTypeMap['boolean']
export type DateField = FieldTypeMap['date']
export type SelectField = FieldTypeMap['select']
export type RichTextField = FieldTypeMap['richtext']
export type RelationshipField = FieldTypeMap['relationship']
export type GroupField = FieldTypeMap['group']
export type ArrayField = FieldTypeMap['array']

export type { BaseFieldConfig }
