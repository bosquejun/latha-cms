export type { FieldMeta } from './meta.js'
export {
  type FieldTypeEntry,
  FieldRegistry,
  baseFieldConfigSchema,
  type BaseFieldConfig,
  fieldRegistry,
  registerFieldType,
} from './registry.js'
export type { FieldTypeMap, FieldFromMap, FieldTypeKey } from './types.js'
// builtins.ts is a side-effect module — imported once in bootstrap/index.ts
