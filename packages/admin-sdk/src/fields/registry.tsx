/**
 * Field renderer registry.
 *
 * Maps a `FieldType` to the React renderer used in admin forms. The registry is
 * a plain map so apps and plugins can override or extend renderers
 * (`registerFieldRenderer`) without forking the SDK.
 */

import type { FieldRenderer } from './types.js'
import { TextField } from './renderers/TextField.js'
import { RichTextField } from './renderers/RichTextField.js'
import { NumberField } from './renderers/NumberField.js'
import { BooleanField } from './renderers/BooleanField.js'
import { DateField } from './renderers/DateField.js'
import { SelectField } from './renderers/SelectField.js'
import { BlocksField } from './renderers/BlocksField.js'
import { RelationshipField } from './renderers/RelationshipField.js'
import { GroupField } from './renderers/GroupField.js'
import { ArrayField } from './renderers/ArrayField.js'
import { FallbackField } from './renderers/FallbackField.js'

// Keyed by string so module-registered types (taxonomy, media, etc.) can be
// added without requiring admin-sdk to know about every possible type.
const registry = new Map<string, FieldRenderer>([
  ['text', TextField],
  ['richtext', RichTextField],
  ['number', NumberField],
  ['boolean', BooleanField],
  ['date', DateField],
  ['select', SelectField],
  ['blocks', BlocksField],
  ['media', FallbackField],
  ['relationship', RelationshipField],
  ['taxonomy', FallbackField],
  ['group', GroupField],
  ['array', ArrayField],
])

/** Resolve the renderer for a field type, falling back to the JSON editor. */
export function getFieldRenderer(type: string): FieldRenderer {
  return registry.get(type) ?? FallbackField
}

export function registerFieldRenderer(type: string, renderer: FieldRenderer): void {
  registry.set(type, renderer)
}

export type { FieldRenderer, FieldControlProps } from './types.js'
