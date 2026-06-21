/**
 * Field renderer registry.
 *
 * Maps a `FieldType` to the React renderer used in admin forms. The registry is
 * a plain map so apps and plugins can override or extend renderers
 * (`registerFieldRenderer`) without forking the SDK.
 */

import type { FieldType } from '@latha/core'
import type { FieldRenderer } from './types.js'
import { TextField } from './renderers/TextField.js'
import { RichTextField } from './renderers/RichTextField.js'
import { NumberField } from './renderers/NumberField.js'
import { BooleanField } from './renderers/BooleanField.js'
import { DateField } from './renderers/DateField.js'
import { SelectField } from './renderers/SelectField.js'
import { FallbackField } from './renderers/FallbackField.js'

const registry = new Map<FieldType, FieldRenderer>([
  ['text', TextField],
  ['richtext', RichTextField],
  ['number', NumberField],
  ['boolean', BooleanField],
  ['date', DateField],
  ['select', SelectField],
  ['media', FallbackField],
  ['relationship', FallbackField],
  ['taxonomy', FallbackField],
  ['group', FallbackField],
  ['array', FallbackField],
])

/** Resolve the renderer for a field type, falling back to the JSON editor. */
export function getFieldRenderer(type: FieldType): FieldRenderer {
  return registry.get(type) ?? FallbackField
}

/** Override or add a renderer for a field type. */
export function registerFieldRenderer(
  type: FieldType,
  renderer: FieldRenderer,
): void {
  registry.set(type, renderer)
}

export type { FieldRenderer, FieldControlProps } from './types.js'
