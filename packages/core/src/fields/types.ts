/**
 * Compile-time field type map — the extensibility seam.
 *
 * Core registers its 9 built-in field types here, one entry per schema
 * registered in `builtins.ts` — each entry is `BaseFieldConfig & z.infer<typeof
 * xConfigSchema>`, so the registered Zod schema is the single source of truth
 * for both runtime validation and the compile-time type. Modules that add
 * their own field types follow the same pattern in their own module
 * declaration files:
 *
 * ```ts
 * // @latha/content (taxonomy field)
 * declare module '@latha/core' {
 *   interface FieldTypeMap {
 *     taxonomy: BaseFieldConfig & z.infer<typeof taxonomyFieldConfigSchema>
 *   }
 * }
 * ```
 *
 * `FieldFromMap` and `FieldTypeKey` widen automatically whenever a module
 * augments `FieldTypeMap`, so the rest of the type system picks up new
 * field types without any changes to core.
 */

import type { z } from 'zod'
import type { BaseFieldConfig } from './registry.js'
import type {
  arrayFieldConfigSchema,
  booleanFieldConfigSchema,
  dateFieldConfigSchema,
  groupFieldConfigSchema,
  numberFieldConfigSchema,
  relationshipFieldConfigSchema,
  richtextFieldConfigSchema,
  selectFieldConfigSchema,
  textFieldConfigSchema,
} from './builtins.js'

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
  text: BaseFieldConfig & z.infer<typeof textFieldConfigSchema>
  number: BaseFieldConfig & z.infer<typeof numberFieldConfigSchema>
  boolean: BaseFieldConfig & z.infer<typeof booleanFieldConfigSchema>
  date: BaseFieldConfig & z.infer<typeof dateFieldConfigSchema>
  select: BaseFieldConfig & z.infer<typeof selectFieldConfigSchema>
  // `lexicalConfig` isn't part of the runtime-validated schema — it's a
  // type-only passthrough for the open `RichTextExtensions` seam (see above).
  richtext: BaseFieldConfig &
    z.infer<typeof richtextFieldConfigSchema> & { lexicalConfig?: RichTextExtensions }
  relationship: BaseFieldConfig & z.infer<typeof relationshipFieldConfigSchema>
  // `fields` is loosely typed in the runtime schema (open/extensible field
  // registry — see builtins.ts); narrowed back to `Field[]` here for
  // compile-time ergonomics.
  group: BaseFieldConfig &
    Omit<z.infer<typeof groupFieldConfigSchema>, 'fields'> & { fields: FieldFromMap[] }
  array: BaseFieldConfig &
    Omit<z.infer<typeof arrayFieldConfigSchema>, 'fields'> & { fields: FieldFromMap[] }
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
