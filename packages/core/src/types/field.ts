/**
 * Field definitions.
 *
 * Fields are the data-shape unit of LathaCMS. Every field compiles to a Zod
 * schema via the field registry (see `fields/registry.ts`), which in turn
 * drives API validation, form validation, and TypeScript inference.
 */

import type { FieldMeta } from '../fields/meta.js'

export type { FieldMeta }

export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'richtext'
  | 'media'
  | 'relationship'
  | 'taxonomy'
  | 'group'
  | 'array'

interface BaseField {
  name: string
  type: FieldType
  required?: boolean
  unique?: boolean
  /** Default value applied when the incoming payload omits the field. */
  defaultValue?: unknown
  /** Display hints for the admin UI. The kernel carries this opaquely. */
  meta?: FieldMeta
}

export interface TextField extends BaseField {
  type: 'text'
  minLength?: number
  maxLength?: number
}

export interface NumberField extends BaseField {
  type: 'number'
  min?: number
  max?: number
  integer?: boolean
}

export interface BooleanField extends BaseField {
  type: 'boolean'
}

export interface DateField extends BaseField {
  type: 'date'
}

export interface SelectField extends BaseField {
  type: 'select'
  options: string[]
  /** Allow selecting multiple options (stored as an array). */
  many?: boolean
}

export interface RichTextField extends BaseField {
  type: 'richtext'
}

export interface MediaField extends BaseField {
  type: 'media'
}

export interface RelationshipField extends BaseField {
  type: 'relationship'
  /** Target collection slug. */
  to: string
  /** Allow relating to many documents (stored as an array of ids). */
  many?: boolean
}

export interface TaxonomyField extends BaseField {
  type: 'taxonomy'
  /** Target taxonomy slug. */
  to: string
  many?: boolean
}

export interface GroupField extends BaseField {
  type: 'group'
  fields: Field[]
}

export interface ArrayField extends BaseField {
  type: 'array'
  fields: Field[]
}

export type Field =
  | TextField
  | NumberField
  | BooleanField
  | DateField
  | SelectField
  | RichTextField
  | MediaField
  | RelationshipField
  | TaxonomyField
  | GroupField
  | ArrayField
